/**
 * [INPUT]: Enabled LLM provider/model mapping and encrypted credential resolver
 * [OUTPUT]: Pi Model, StreamFn, safe metadata, and error redaction closure
 * [POS]: The only bridge from Anyhunt LLM configuration to Pi model execution
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { StreamFn } from '@earendil-works/pi-agent-core';
import { LlmUpstreamResolverService } from '../../llm/llm-upstream-resolver.service';
import { loadPiStream } from './pi-esm-loader';

type SupportedProviderType =
  'openai' | 'openai-compatible' | 'openrouter' | 'anthropic' | 'google';

export type PiModelResolutionErrorCode =
  'MODEL_NOT_FOUND' | 'UNSUPPORTED_PROVIDER' | 'MODEL_RESOLUTION_FAILED';

export class PiModelResolutionError extends Error {
  constructor(
    readonly code: PiModelResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PiModelResolutionError';
  }
}

export interface ResolvedPiModel {
  model: Model<Api>;
  streamFn: StreamFn;
  metadata: {
    providerId: string;
    providerType: string;
    modelId: string;
    upstreamModelId: string;
  };
  redactError(value: string): string;
}

const PROVIDER_CONFIG: Record<
  SupportedProviderType,
  {
    api: Api;
    defaultBaseUrl: string;
    loadStream: () => Promise<StreamFn>;
  }
> = {
  openai: {
    api: 'openai-responses',
    defaultBaseUrl: 'https://api.openai.com/v1',
    loadStream: () => loadPiStream('openai-responses'),
  },
  'openai-compatible': {
    api: 'openai-completions',
    defaultBaseUrl: 'https://api.openai.com/v1',
    loadStream: () => loadPiStream('openai-completions'),
  },
  openrouter: {
    api: 'openai-completions',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    loadStream: () => loadPiStream('openai-completions'),
  },
  anthropic: {
    api: 'anthropic-messages',
    defaultBaseUrl: 'https://api.anthropic.com',
    loadStream: () => loadPiStream('anthropic-messages'),
  },
  google: {
    api: 'google-generative-ai',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    loadStream: () => loadPiStream('google-generative-ai'),
  },
};

function isSupportedProviderType(
  value: string,
): value is SupportedProviderType {
  return Object.prototype.hasOwnProperty.call(PROVIDER_CONFIG, value);
}

function supportsCapability(value: unknown, capability: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const configured = (value as Record<string, unknown>)[capability];
  if (configured === true) return true;
  return (
    configured !== null &&
    typeof configured === 'object' &&
    (configured as Record<string, unknown>).enabled === true
  );
}

@Injectable()
export class PiModelResolverService {
  constructor(private readonly upstreamResolver: LlmUpstreamResolverService) {}

  async resolve(requestedModelId?: string): Promise<ResolvedPiModel> {
    let upstream: Awaited<
      ReturnType<LlmUpstreamResolverService['resolveUpstream']>
    >;

    try {
      upstream = await this.upstreamResolver.resolveUpstream({
        requestedModelId,
        purpose: 'agent',
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new PiModelResolutionError(
          'MODEL_NOT_FOUND',
          'Requested model is not available',
        );
      }
      throw new PiModelResolutionError(
        'MODEL_RESOLUTION_FAILED',
        'Model configuration could not be resolved',
      );
    }

    const providerType = upstream.provider.providerType;
    if (!isSupportedProviderType(providerType)) {
      throw new PiModelResolutionError(
        'UNSUPPORTED_PROVIDER',
        'Configured model provider is not supported',
      );
    }

    const config = PROVIDER_CONFIG[providerType];
    const apiKey = upstream.apiKey;
    const stream = await config.loadStream();
    const model: Model<Api> = {
      id: upstream.upstreamModelId,
      name: upstream.model.displayName,
      api: config.api,
      provider: upstream.provider.id,
      baseUrl: upstream.provider.baseUrl ?? config.defaultBaseUrl,
      reasoning: supportsCapability(
        upstream.model.capabilitiesJson,
        'reasoning',
      ),
      input: supportsCapability(upstream.model.capabilitiesJson, 'vision')
        ? ['text', 'image']
        : ['text'],
      cost: {
        input: upstream.model.inputTokenPrice,
        output: upstream.model.outputTokenPrice,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow: upstream.model.maxContextTokens,
      maxTokens: upstream.model.maxOutputTokens,
    };

    const streamFn: StreamFn = (activeModel, context, options) =>
      stream(activeModel, context, {
        ...options,
        apiKey,
      });

    return {
      model,
      streamFn,
      metadata: {
        providerId: upstream.provider.id,
        providerType,
        modelId: upstream.requestedModelId,
        upstreamModelId: upstream.upstreamModelId,
      },
      redactError: (value) => value.replaceAll(apiKey, '[REDACTED]'),
    };
  }
}
