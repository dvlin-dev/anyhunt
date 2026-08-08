import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AgentRunLimits } from '../../contracts/agent-run.types';
import { AgentToolRegistryService } from '../../tools/agent-tool-registry.service';
import type { AgentToolPermission } from '../../tools/agent-tool-registry.service';
import { ActivatedSkillStore } from '../../tools/activate-skill.tool';
import { EvidenceLedgerStore } from '../../tools/evidence-ledger';
import { DigestSubmissionStore } from '../../tools/submit-digest.tool';
import type {
  AgentCheckpoint,
  AgentCheckpointService,
} from '../agent-checkpoint.service';
import { AgentRunContextStore } from '../agent-run-context';
import { AgentRunnerService } from '../agent-runner.service';
import type { PiAgentRuntimeService } from '../pi-agent-runtime.service';

const LIMITS: AgentRunLimits = {
  timeoutMs: 60_000,
  maxTurns: 10,
  maxToolCalls: 20,
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxEstimatedCostUsd: 10,
};

function database() {
  return {
    run: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-1',
        topicId: 'topic-1',
        status: 'QUEUED',
        startedAt: null,
        cancelRequestedAt: null,
      }),
      update: vi.fn().mockResolvedValue({ id: 'run-1' }),
    },
  } as unknown as PrismaService;
}

function checkpointStore() {
  let stored: AgentCheckpoint | null = null;
  return {
    load: vi.fn(async () => structuredClone(stored)),
    save: vi.fn(async (_runId: string, value: AgentCheckpoint) => {
      stored = structuredClone(value);
    }),
    clear: vi.fn(async () => {
      stored = null;
    }),
    value: () => stored,
  };
}

function runner(
  runtime: Pick<PiAgentRuntimeService, 'run'>,
  checkpoints = checkpointStore(),
  registry = new AgentToolRegistryService(),
  databaseClient = database(),
) {
  registry.freeze();
  const ledgers = new EvidenceLedgerStore();
  const submissions = new DigestSubmissionStore();
  const activated = new ActivatedSkillStore();
  return {
    service: new AgentRunnerService(
      runtime as PiAgentRuntimeService,
      checkpoints as unknown as AgentCheckpointService,
      registry,
      databaseClient,
      new AgentRunContextStore(),
      ledgers,
      submissions,
      activated,
    ),
    checkpoints,
    ledgers,
    submissions,
    activated,
    database: databaseClient,
  };
}

function request() {
  return {
    runId: 'run-1',
    topicId: 'topic-1',
    systemPrompt: 'Research and submit a Digest.',
    prompt: 'Find current evidence.',
    model: {} as never,
    limits: LIMITS,
    allowedPermissions: new Set<AgentToolPermission>(),
  };
}

const simulatedCrash = new Error('simulated process interruption');

describe('AgentRunnerService interruption checkpoints', () => {
  it('saves resumable messages after a model response', async () => {
    const runtime = {
      run: vi.fn(async (input) => {
        await input.onState?.({
          phase: 'model_response',
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Research' }] },
            {
              role: 'assistant',
              content: [
                {
                  type: 'toolCall',
                  id: 'call-1',
                  name: 'web_search',
                  arguments: { query: 'news' },
                },
              ],
            },
          ],
        });
        throw simulatedCrash;
      }),
    };
    const state = runner(runtime as never);

    await expect(state.service.run(request())).rejects.toThrow(
      'simulated process interruption',
    );
    expect(state.checkpoints.value()?.messages).toHaveLength(2);
  });

  it('checkpoints before a Tool without marking it complete', async () => {
    const runtime = {
      run: vi.fn(async (input) => {
        await input.onEvent?.({
          type: 'tool_call',
          toolCallId: 'call-1',
          toolName: 'web_search',
          input: { query: 'news' },
        });
        throw simulatedCrash;
      }),
    };
    const state = runner(runtime as never);

    await expect(state.service.run(request())).rejects.toThrow();
    expect(state.checkpoints.value()?.completedToolCallIds).toEqual([]);
  });

  it('marks a Tool complete only after its Tool result message is durable', async () => {
    const runtime = {
      run: vi.fn(async (input) => {
        await input.onState?.({
          phase: 'tool_result',
          completedToolCallId: 'call-1',
          completedToolName: 'web_search',
          messages: [
            { role: 'assistant', content: [] },
            {
              role: 'toolResult',
              toolCallId: 'call-1',
              toolName: 'web_search',
              content: [{ type: 'text', text: '{"results":[]}' }],
            },
          ],
        });
        throw simulatedCrash;
      }),
    };
    const state = runner(runtime as never);

    await expect(state.service.run(request())).rejects.toThrow();
    expect(state.checkpoints.value()?.completedToolCallIds).toEqual(['call-1']);
  });

  it('persists the validated Digest immediately after submission', async () => {
    const runtime = {
      run: vi.fn(async (input) => {
        const submission = {
          narrative: 'Current update.',
          items: [],
          emptyReason: 'No qualifying results.',
        };
        state.submissions.submit('run-1', submission);
        await input.onState?.({
          phase: 'tool_result',
          completedToolCallId: 'call-submit',
          completedToolName: 'submit_digest',
          messages: [],
        });
        throw simulatedCrash;
      }),
    };
    const state = runner(runtime as never);

    await expect(state.service.run(request())).rejects.toThrow();
    expect(state.checkpoints.value()).toMatchObject({
      submitted: true,
      submission: { emptyReason: 'No qualifying results.' },
    });
  });

  it('skips a completed Skill Tool Call after an interrupted checkpoint write', async () => {
    const execute = vi.fn().mockResolvedValue({ saved: true, version: 1 });
    const registry = new AgentToolRegistryService();
    registry.register({
      name: 'save_skill',
      description: 'Save managed skill.',
      inputSchema: z.object({ markdown: z.string() }),
      permission: 'skill.write',
      timeoutMs: 1_000,
      maxResultChars: 1_000,
      execute,
    });
    let attempt = 0;
    const runtime = {
      run: vi.fn(async (input) => {
        attempt += 1;
        const tool = input.tools[0];
        await tool.execute(
          { markdown: '# Skill' },
          {
            runId: 'run-1',
            toolCallId: 'call-skill',
            signal: new AbortController().signal,
          },
        );
        if (attempt === 1) {
          await input.onState?.({
            phase: 'tool_result',
            completedToolCallId: 'call-skill',
            completedToolName: 'save_skill',
            messages: [],
          });
          throw simulatedCrash;
        }
        state.submissions.submit('run-1', {
          items: [],
          emptyReason: 'No qualifying results.',
        });
        return {
          text: '',
          turns: 0,
          toolCalls: 0,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            estimatedCostUsd: 0,
          },
          messages: [],
        };
      }),
    };
    const state = runner(runtime as never, checkpointStore(), registry);
    const runRequest = {
      ...request(),
      allowedPermissions: new Set(['skill.write'] as const),
    };

    await expect(state.service.run(runRequest)).rejects.toThrow();
    await state.service.run(runRequest);
    expect(execute).toHaveBeenCalledOnce();
  });
});

describe('AgentRunnerService cancellation and budget boundaries', () => {
  it('turns a persisted cancelRequestedAt into a canceled Run without calling Pi', async () => {
    const databaseClient = database();
    vi.mocked(databaseClient.run.findUnique).mockResolvedValueOnce({
      id: 'run-1',
      topicId: 'topic-1',
      status: 'QUEUED',
      startedAt: null,
      cancelRequestedAt: new Date(),
    } as never);
    const runtime = { run: vi.fn() };
    const state = runner(
      runtime as never,
      checkpointStore(),
      new AgentToolRegistryService(),
      databaseClient,
    );

    await expect(state.service.run(request())).rejects.toMatchObject({
      code: 'CANCELED',
    });
    expect(runtime.run).not.toHaveBeenCalled();
    expect(databaseClient.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    );
  });

  it('rejects a resumed Run whose persisted budget is already exhausted', async () => {
    const checkpoints = checkpointStore();
    await checkpoints.save('run-1', {
      version: 1,
      messages: [],
      completedToolCallIds: [],
      evidence: [],
      budget: {
        turns: 0,
        toolCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0,
        elapsedMs: LIMITS.timeoutMs,
      },
      activatedSkillVersions: [],
      submitted: false,
    });
    const runtime = { run: vi.fn() };
    const state = runner(runtime as never, checkpoints);

    await expect(state.service.run(request())).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT',
    });
    expect(runtime.run).not.toHaveBeenCalled();
  });
});
