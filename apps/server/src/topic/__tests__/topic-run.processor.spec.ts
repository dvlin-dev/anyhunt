import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AgentCheckpointService } from '../../agent/runtime/agent-checkpoint.service';
import type { AgentRunnerService } from '../../agent/runtime/agent-runner.service';
import type { PiModelResolverService } from '../../agent/runtime/pi-model-resolver.service';
import type { SkillService } from '../../agent/skills/skill.service';
import type { TopicRepositoryService } from '../topic.repository.service';
import { TopicRunProcessor } from '../topic-run.processor';
import type { DeliveryService } from '../../delivery/delivery.service';

describe('TopicRunProcessor', () => {
  it('executes one shared Agent Run and atomically hands off one RunItem set', async () => {
    const repository = {
      getRunForExecution: vi.fn().mockResolvedValue({
        id: 'run-1',
        topicId: 'topic-1',
        status: 'QUEUED',
        trigger: 'SCHEDULED',
        topic: {
          id: 'topic-1',
          title: 'AI infrastructure',
          goal: 'Track releases.',
          locale: 'en',
          status: 'ACTIVE',
          enabled: true,
        },
      }),
      completeRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      markRunCanceled: vi.fn(),
    };
    const evidence = {
      normalizedUrl: 'https://example.com/article?a=1&b=2',
      title: 'Primary source',
      retrievedAt: '2026-08-03T00:00:00.000Z',
      toolName: 'web_fetch',
      contentHash: 'a'.repeat(64),
    };
    const runner = {
      run: vi.fn().mockResolvedValue({
        submission: {
          narrative: 'Material update.',
          items: [
            {
              url: 'https://example.com/article?b=2&a=1#fragment',
              title: 'Release',
              summary: 'A release happened.',
              selectionReason: 'Primary source.',
            },
          ],
        },
        evidence: [evidence],
        runtime: {
          turns: 3,
          toolCalls: 4,
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            estimatedCostUsd: 0.01,
          },
        },
        resumed: false,
      }),
    };
    const models = {
      resolve: vi.fn().mockResolvedValue({
        metadata: {
          providerId: 'provider-1',
          providerType: 'openai-compatible',
          modelId: 'model-1',
          upstreamModelId: 'upstream-1',
        },
      }),
    };
    const skills = {
      getTopicSkillCatalog: vi.fn().mockResolvedValue({
        attachedSkills: [
          { id: 'skill-1', name: 'sources', description: 'Find sources.' },
        ],
      }),
      getManagedVersion: vi.fn().mockResolvedValue(null),
    };
    const checkpoints = { clear: vi.fn().mockResolvedValue(undefined) };
    const deliveries = { enqueueForRun: vi.fn().mockResolvedValue(undefined) };
    const processor = new TopicRunProcessor(
      repository as unknown as TopicRepositoryService,
      runner as unknown as AgentRunnerService,
      models as unknown as PiModelResolverService,
      skills as unknown as SkillService,
      checkpoints as unknown as AgentCheckpointService,
      deliveries as unknown as DeliveryService,
    );

    await processor.process({ data: { runId: 'run-1' } } as never);

    expect(runner.run).toHaveBeenCalledOnce();
    expect(repository.completeRun).toHaveBeenCalledWith({
      runId: 'run-1',
      status: 'SUCCEEDED',
      narrative: 'Material update.',
      emptyReason: undefined,
      runtimeStats: expect.objectContaining({
        model: expect.objectContaining({ modelId: 'model-1' }),
        turns: 3,
        toolCalls: 4,
      }),
      items: [
        {
          canonicalUrlHash: createHash('sha256')
            .update('https://example.com/article?a=1&b=2')
            .digest('hex'),
          title: 'Release',
          url: 'https://example.com/article?a=1&b=2',
          summary: 'A release happened.',
          selectionReason: 'Primary source.',
          rank: 1,
          retrievedAt: new Date('2026-08-03T00:00:00.000Z'),
          sourceTitle: 'Primary source',
          contentHash: 'a'.repeat(64),
        },
      ],
    });
    expect(checkpoints.clear).toHaveBeenCalledWith('run-1');
    expect(deliveries.enqueueForRun).toHaveBeenCalledWith('run-1');
  });

  it('does not execute terminal or suspended Runs', async () => {
    const repository = {
      getRunForExecution: vi.fn().mockResolvedValue({
        id: 'run-1',
        topicId: 'topic-1',
        status: 'QUEUED',
        trigger: 'SCHEDULED',
        topic: { status: 'SUSPENDED', enabled: false },
      }),
      markRunCanceled: vi.fn().mockResolvedValue({}),
    };
    const runner = { run: vi.fn() };
    const processor = new TopicRunProcessor(
      repository as unknown as TopicRepositoryService,
      runner as unknown as AgentRunnerService,
      {} as PiModelResolverService,
      {} as SkillService,
      {} as AgentCheckpointService,
      {} as DeliveryService,
    );

    await processor.process({ data: { runId: 'run-1' } } as never);

    expect(repository.markRunCanceled).toHaveBeenCalledOnce();
    expect(runner.run).not.toHaveBeenCalled();
  });
});
