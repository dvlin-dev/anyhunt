import { describe, expect, it, vi } from 'vitest';
import { OperationalMetricsService } from '../operational-metrics.service';

describe('OperationalMetricsService', () => {
  it('collects bounded depth from every required queue', async () => {
    const queues = Array.from({ length: 4 }, (_value, index) => ({
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: index + 1,
        active: 1,
        delayed: 0,
        failed: 0,
      }),
    }));
    const service = new OperationalMetricsService(
      queues[0] as never,
      queues[1] as never,
      queues[2] as never,
      queues[3] as never,
    );

    await expect(service.logQueueDepths()).resolves.toEqual({
      scrape: 2,
      'topic-run': 3,
      'delivery-email': 4,
      'delivery-webhook': 5,
    });
    for (const queue of queues) {
      expect(queue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
    }
  });
});
