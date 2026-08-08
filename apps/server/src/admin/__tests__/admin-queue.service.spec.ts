import { describe, expect, it, vi } from 'vitest';
import type { Job, Queue } from 'bullmq';
import { AdminQueueService } from '../admin-queue.service';

describe('AdminQueueService diagnostics', () => {
  it('returns an allowlisted job projection with a bounded redacted error', async () => {
    const job = {
      id: 'job-1',
      name: 'run',
      data: { prompt: 'private', webhookSecret: 'secret-value-12345678' },
      opts: { attempts: 3 },
      attemptsMade: 1,
      processedOn: null,
      finishedOn: null,
      timestamp: Date.now(),
      failedReason: 'Bearer private-token failed at https://secret.example/path?token=abc',
    } as unknown as Job;
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ failed: 1 }),
      getFailed: vi.fn().mockResolvedValue([job]),
    } as unknown as Queue;
    const service = new AdminQueueService(queue, queue, queue, queue);

    const result = await service.getQueueJobs('topic-run', {
      status: 'failed',
      page: 1,
      limit: 20,
    });

    expect(result.items[0]).toEqual(expect.objectContaining({
      id: 'job-1',
      name: 'run',
      attemptsMade: 1,
      maxAttempts: 3,
      error: 'Bearer [REDACTED] failed at [URL REDACTED]',
    }));
    expect(result.items[0]).not.toHaveProperty('data');
    expect(result.items[0]).not.toHaveProperty('returnvalue');
    expect(result.items[0]).not.toHaveProperty('stacktrace');
  });
});
