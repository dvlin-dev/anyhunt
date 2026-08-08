import { describe, expect, it, vi } from 'vitest';
import type { TopicRepositoryService } from '../topic.repository.service';
import { TopicSchedulerProcessor } from '../topic-scheduler.processor';

describe('TopicSchedulerProcessor', () => {
  it('reconciles queued Runs and enqueues newly claimed occurrences by Run ID', async () => {
    const repository = {
      listQueuedRunIds: vi
        .fn()
        .mockResolvedValue([{ id: 'run-existing' }]),
      claimDueRuns: vi
        .fn()
        .mockResolvedValue([{ id: 'run-new' }, { id: 'run-existing' }]),
    };
    const queue = { add: vi.fn().mockResolvedValue({}) };
    const scheduler = new TopicSchedulerProcessor(
      repository as unknown as TopicRepositoryService,
      queue as never,
    );

    await scheduler.scheduleDueTopics();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      'run',
      { runId: 'run-existing' },
      expect.objectContaining({ jobId: 'run-existing' }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'run',
      { runId: 'run-new' },
      expect.objectContaining({ jobId: 'run-new' }),
    );
  });
});
