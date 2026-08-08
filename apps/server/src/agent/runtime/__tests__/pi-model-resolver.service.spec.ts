import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { LlmUpstreamResolverService } from '../../../llm/llm-upstream-resolver.service';
import { PiModelResolverService } from '../pi-model-resolver.service';

function createUpstreamResult(apiKey = 'sk-sensitive-provider-key') {
  return {
    requestedModelId: 'agent-model',
    upstreamModelId: 'upstream-model',
    provider: {
      id: 'provider-1',
      providerType: 'openai-compatible',
      name: 'Compatible Provider',
      baseUrl: 'https://api.example.com/v1',
    },
    model: {
      id: 'model-1',
      modelId: 'agent-model',
      displayName: 'Agent Model',
      inputTokenPrice: 1,
      outputTokenPrice: 2,
      maxContextTokens: 128_000,
      maxOutputTokens: 8_192,
      capabilitiesJson: { tools: true, reasoning: { enabled: true } },
      sortOrder: 0,
    },
    apiKey,
  };
}

describe('PiModelResolverService', () => {
  it('maps an enabled upstream model without exposing its credential', async () => {
    const apiKey = 'sk-sensitive-provider-key';
    const upstream = {
      resolveUpstream: vi.fn().mockResolvedValue(createUpstreamResult(apiKey)),
    } as unknown as LlmUpstreamResolverService;
    const service = new PiModelResolverService(upstream);

    const resolved = await service.resolve();

    expect(resolved.model).toMatchObject({
      id: 'upstream-model',
      provider: 'provider-1',
      baseUrl: 'https://api.example.com/v1',
      api: 'openai-completions',
    });
    expect(JSON.stringify(resolved)).not.toContain(apiKey);
    expect(resolved.redactError(`Request failed: ${apiKey}`)).toBe(
      'Request failed: [REDACTED]',
    );
  });

  it.each([
    ['openai', 'openai-responses'],
    ['openai-compatible', 'openai-completions'],
    ['openrouter', 'openai-completions'],
    ['anthropic', 'anthropic-messages'],
    ['google', 'google-generative-ai'],
  ] as const)('maps %s to the Pi %s API', async (providerType, api) => {
    const upstream = {
      resolveUpstream: vi.fn().mockResolvedValue({
        ...createUpstreamResult(),
        provider: {
          ...createUpstreamResult().provider,
          providerType,
        },
      }),
    } as unknown as LlmUpstreamResolverService;

    await expect(
      new PiModelResolverService(upstream).resolve(),
    ).resolves.toMatchObject({ model: { api } });
  });

  it('fails closed for an unsupported provider type', async () => {
    const upstream = {
      resolveUpstream: vi.fn().mockResolvedValue({
        ...createUpstreamResult(),
        provider: {
          ...createUpstreamResult().provider,
          providerType: 'untrusted-provider',
        },
      }),
    } as unknown as LlmUpstreamResolverService;

    await expect(
      new PiModelResolverService(upstream).resolve(),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' });
  });

  it('maps an unavailable model to a stable model-not-found error', async () => {
    const upstream = {
      resolveUpstream: vi
        .fn()
        .mockRejectedValue(new BadRequestException('Model is not available')),
    } as unknown as LlmUpstreamResolverService;
    const service = new PiModelResolverService(upstream);

    await expect(service.resolve('missing')).rejects.toMatchObject({
      code: 'MODEL_NOT_FOUND',
    });
  });
});
