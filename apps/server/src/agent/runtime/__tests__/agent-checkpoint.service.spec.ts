import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import {
  AgentCheckpointService,
  type AgentCheckpoint,
} from '../agent-checkpoint.service';

function prisma() {
  return {
    run: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'run-1' }),
    },
  } as unknown as PrismaService;
}

describe('AgentCheckpointService', () => {
  it('persists only bounded resumable messages and removes hidden thinking', async () => {
    const database = prisma();
    const service = new AgentCheckpointService(database);
    const checkpoint: AgentCheckpoint = {
      version: 1,
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'private reasoning' },
            { type: 'text', text: 'Public answer' },
            {
              type: 'toolCall',
              id: 'call-1',
              name: 'web_search',
              arguments: { query: 'news' },
            },
          ],
          usage: { input: 1, output: 1 },
          timestamp: 1,
        },
      ],
      completedToolCallIds: [],
      evidence: [],
      budget: {
        turns: 1,
        toolCalls: 0,
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0,
        elapsedMs: 10,
      },
      activatedSkillVersions: [],
      submitted: false,
    };

    await service.save('run-1', checkpoint);

    const written = vi.mocked(database.run.update).mock.calls[0]?.[0].data
      .checkpoint;
    expect(JSON.stringify(written)).not.toContain('private reasoning');
    expect(JSON.stringify(written)).toContain('Public answer');
    expect(JSON.stringify(written)).toContain('web_search');
  });

  it('rejects oversized or malformed checkpoints before persistence', async () => {
    const database = prisma();
    const service = new AgentCheckpointService(database);

    await expect(
      service.save('run-1', {
        version: 1,
        messages: [{ role: 'user', content: 'x'.repeat(1_100_000) }],
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
          elapsedMs: 0,
        },
        activatedSkillVersions: [],
        submitted: false,
      }),
    ).rejects.toThrow('Checkpoint');
    expect(database.run.update).not.toHaveBeenCalled();
  });
});
