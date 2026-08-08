/**
 * [INPUT]: Fixed Tool definitions and per-run permission policy
 * [OUTPUT]: Frozen, validated, bounded framework-neutral Agent Tools
 * [POS]: Single execution boundary between Pi and trusted server Tool adapters
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type {
  AgentToolContext,
  AgentToolDefinition,
} from '../contracts/agent-tool.types';

export type AgentToolPermission =
  'network.read' | 'skill.read' | 'skill.write' | 'run.submit' | 'mcp.invoke';

export interface RegisteredAgentToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> extends AgentToolDefinition<TInput, TOutput> {
  permission: AgentToolPermission;
  maxResultChars: number;
}

export interface AgentToolRunPolicy {
  allowedPermissions: ReadonlySet<AgentToolPermission>;
  redactError?: (value: string) => string;
}

export type AgentToolRegistryErrorCode =
  | 'ABORTED'
  | 'DUPLICATE_TOOL'
  | 'EXECUTION_FAILED'
  | 'INVALID_DEFINITION'
  | 'INVALID_INPUT'
  | 'INVALID_SCHEMA'
  | 'PERMISSION_DENIED'
  | 'REGISTRY_FROZEN'
  | 'REGISTRY_NOT_FROZEN'
  | 'TIMEOUT'
  | 'UNKNOWN_TOOL';

export class AgentToolRegistryError extends Error {
  constructor(
    readonly code: AgentToolRegistryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AgentToolRegistryError';
  }
}

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*$/;
const MAX_SAFE_ERROR_CHARS = 300;

function redactCommonSecrets(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(?:sk|key|token|secret)[-_][A-Za-z0-9._-]{8,}\b/gi,
      '[REDACTED]',
    );
}

function safeErrorMessage(
  cause: unknown,
  redactError?: (value: string) => string,
): string {
  const raw = cause instanceof Error ? cause.message : 'Tool execution failed';
  let redacted = redactCommonSecrets(raw);
  try {
    redacted = redactError?.(redacted) ?? redacted;
  } catch {
    redacted = 'Tool execution failed';
  }
  return redacted.slice(0, MAX_SAFE_ERROR_CHARS) || 'Tool execution failed';
}

function serializeResult(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[Unserializable tool result]';
  }
}

function boundResult(value: unknown, maxResultChars: number): unknown {
  const serialized = serializeResult(value);
  if (serialized.length <= maxResultChars) return value;
  return {
    truncated: true,
    content: serialized.slice(0, maxResultChars),
  };
}

@Injectable()
export class AgentToolRegistryService {
  private readonly logger = new Logger(AgentToolRegistryService.name);
  private readonly definitions = new Map<
    string,
    RegisteredAgentToolDefinition<unknown, unknown>
  >();
  private frozen = false;

  register<TInput, TOutput>(
    definition: RegisteredAgentToolDefinition<TInput, TOutput>,
  ): void {
    if (this.frozen) {
      throw new AgentToolRegistryError(
        'REGISTRY_FROZEN',
        'Tool registry is frozen',
      );
    }
    if (this.definitions.has(definition.name)) {
      throw new AgentToolRegistryError(
        'DUPLICATE_TOOL',
        `Tool already registered: ${definition.name}`,
      );
    }
    this.validateDefinition(definition);
    this.definitions.set(definition.name, definition);
  }

  freeze(): void {
    this.frozen = true;
  }

  createRunTools(
    policy: AgentToolRunPolicy,
  ): AgentToolDefinition<unknown, unknown>[] {
    this.assertFrozen();
    return [...this.definitions.values()]
      .filter((definition) =>
        policy.allowedPermissions.has(definition.permission),
      )
      .map((definition) => this.wrap(definition, policy));
  }

  resolveTool(
    name: string,
    policy: AgentToolRunPolicy,
  ): AgentToolDefinition<unknown, unknown> {
    this.assertFrozen();
    const definition = this.definitions.get(name);
    if (!definition) {
      throw new AgentToolRegistryError('UNKNOWN_TOOL', 'Unknown Tool');
    }
    if (!policy.allowedPermissions.has(definition.permission)) {
      throw new AgentToolRegistryError(
        'PERMISSION_DENIED',
        'Tool permission denied',
      );
    }
    return this.wrap(definition, policy);
  }

  private assertFrozen(): void {
    if (!this.frozen) {
      throw new AgentToolRegistryError(
        'REGISTRY_NOT_FROZEN',
        'Tool registry must be frozen before use',
      );
    }
  }

  private validateDefinition(
    definition: RegisteredAgentToolDefinition<unknown, unknown>,
  ): void {
    if (
      !TOOL_NAME_PATTERN.test(definition.name) ||
      !definition.description.trim() ||
      typeof definition.execute !== 'function' ||
      !Number.isSafeInteger(definition.timeoutMs) ||
      definition.timeoutMs <= 0 ||
      !Number.isSafeInteger(definition.maxResultChars) ||
      definition.maxResultChars <= 0
    ) {
      throw new AgentToolRegistryError(
        'INVALID_DEFINITION',
        'Invalid Tool definition',
      );
    }

    try {
      if (
        typeof definition.inputSchema?.safeParse !== 'function' ||
        typeof definition.inputSchema?.parse !== 'function'
      ) {
        throw new Error('Not a Zod schema');
      }
      z.toJSONSchema(definition.inputSchema);
    } catch {
      throw new AgentToolRegistryError(
        'INVALID_SCHEMA',
        'Tool input must use a JSON Schema-compatible Zod schema',
      );
    }
  }

  private wrap(
    definition: RegisteredAgentToolDefinition<unknown, unknown>,
    policy: AgentToolRunPolicy,
  ): AgentToolDefinition<unknown, unknown> {
    return {
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      timeoutMs: definition.timeoutMs,
      execute: async (input, context) => {
        const parsed = definition.inputSchema.safeParse(input);
        if (!parsed.success) {
          this.logToolError(context.runId, definition.name, 'INVALID_INPUT', 0);
          throw new AgentToolRegistryError(
            'INVALID_INPUT',
            'Tool input is invalid',
          );
        }
        return this.executeBounded(
          definition,
          parsed.data,
          context,
          policy.redactError,
        );
      },
    };
  }

  private async executeBounded(
    definition: RegisteredAgentToolDefinition<unknown, unknown>,
    input: unknown,
    context: AgentToolContext,
    redactError?: (value: string) => string,
  ): Promise<unknown> {
    const startedAt = Date.now();
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort();
    context.signal.addEventListener('abort', abortFromParent, { once: true });
    if (context.signal.aborted) controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, definition.timeoutMs);

    try {
      if (controller.signal.aborted) {
        throw new AgentToolRegistryError(
          context.signal.aborted ? 'ABORTED' : 'TIMEOUT',
          context.signal.aborted
            ? 'Tool execution was canceled'
            : 'Tool execution timed out',
        );
      }

      const execution = Promise.resolve().then(() =>
        definition.execute(input, {
          ...context,
          signal: controller.signal,
        }),
      );
      const aborted = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          'abort',
          () =>
            reject(
              new AgentToolRegistryError(
                timedOut ? 'TIMEOUT' : 'ABORTED',
                timedOut
                  ? 'Tool execution timed out'
                  : 'Tool execution was canceled',
              ),
            ),
          { once: true },
        );
      });
      const result = await Promise.race([execution, aborted]);
      return boundResult(result, definition.maxResultChars);
    } catch (cause) {
      if (cause instanceof AgentToolRegistryError) {
        this.logToolError(
          context.runId,
          definition.name,
          cause.code,
          Date.now() - startedAt,
        );
        throw cause;
      }
      if (timedOut) {
        this.logToolError(
          context.runId,
          definition.name,
          'TIMEOUT',
          Date.now() - startedAt,
        );
        throw new AgentToolRegistryError('TIMEOUT', 'Tool execution timed out');
      }
      if (context.signal.aborted || controller.signal.aborted) {
        this.logToolError(
          context.runId,
          definition.name,
          'ABORTED',
          Date.now() - startedAt,
        );
        throw new AgentToolRegistryError(
          'ABORTED',
          'Tool execution was canceled',
        );
      }
      this.logToolError(
        context.runId,
        definition.name,
        'EXECUTION_FAILED',
        Date.now() - startedAt,
      );
      throw new AgentToolRegistryError(
        'EXECUTION_FAILED',
        safeErrorMessage(cause, redactError),
      );
    } finally {
      clearTimeout(timer);
      context.signal.removeEventListener('abort', abortFromParent);
    }
  }

  private logToolError(
    runId: string,
    toolName: string,
    code: AgentToolRegistryErrorCode,
    durationMs: number,
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'tool_error',
        runId,
        toolName,
        code,
        durationMs,
      }),
    );
  }
}
