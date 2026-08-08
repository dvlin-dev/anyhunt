import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { TopicRepositoryService } from '../topic.repository.service';
import { TopicService } from '../topic.service';

function repository() {
  return {
    createOwned: vi.fn().mockResolvedValue({
      topic: { id: 'topic-1', slug: 'ai-infrastructure' },
      initialRun: { id: 'run-initial' },
    }),
    getOwned: vi.fn().mockResolvedValue({
      id: 'topic-1',
      ownerId: 'owner-1',
      cron: '0 9 * * *',
      timezone: 'UTC',
      enabled: true,
    }),
    updateOwned: vi.fn().mockResolvedValue({ id: 'topic-1' }),
    setEnabled: vi.fn().mockResolvedValue({ id: 'topic-1' }),
    setVisibility: vi.fn().mockResolvedValue({ id: 'topic-1' }),
    createManualRun: vi.fn().mockResolvedValue({
      run: { id: 'run-manual' },
      created: true,
    }),
    cancelOwnedRun: vi.fn().mockResolvedValue({ id: 'run-manual' }),
    forkPublic: vi.fn().mockResolvedValue({
      topic: { id: 'topic-fork' },
      initialRun: { id: 'run-fork' },
    }),
  };
}

function queue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };
}

describe('TopicService', () => {
  it('creates the Owner Topic and queues exactly one initial Run', async () => {
    const repo = repository();
    const jobs = queue();
    const service = new TopicService(
      repo as unknown as TopicRepositoryService,
      jobs as never,
    );

    const result = await service.create('owner-1', {
      title: 'AI infrastructure',
      goal: 'Track releases.',
      cron: '0 9 * * *',
      timezone: 'UTC',
      locale: 'en',
    });

    expect(repo.createOwned).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-1' }),
    );
    expect(jobs.add).toHaveBeenCalledWith(
      'run',
      { runId: 'run-initial' },
      expect.objectContaining({ jobId: 'run-initial' }),
    );
    expect(result.topic.id).toBe('topic-1');
  });

  it('keeps update, pause, resume, publish, and unpublish Owner-scoped', async () => {
    const repo = repository();
    const service = new TopicService(
      repo as unknown as TopicRepositoryService,
      queue() as never,
    );

    await service.update('owner-1', 'topic-1', { title: 'Updated' });
    await service.pause('owner-1', 'topic-1');
    await service.resume('owner-1', 'topic-1');
    await service.setVisibility('owner-1', 'topic-1', 'PUBLIC');
    await service.setVisibility('owner-1', 'topic-1', 'PRIVATE');

    expect(repo.updateOwned).toHaveBeenCalledWith(
      'owner-1',
      'topic-1',
      { title: 'Updated' },
    );
    expect(repo.setEnabled).toHaveBeenNthCalledWith(
      1,
      'owner-1',
      'topic-1',
      false,
      null,
    );
    expect(repo.setVisibility).toHaveBeenNthCalledWith(
      1,
      'owner-1',
      'topic-1',
      'PUBLIC',
    );

    repo.updateOwned.mockRejectedValueOnce(new NotFoundException());
    await expect(
      service.update('follower-1', 'topic-1', { title: 'Forbidden' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates an idempotent manual Run and uses its ID as the unique Job ID', async () => {
    const repo = repository();
    const jobs = queue();
    const service = new TopicService(
      repo as unknown as TopicRepositoryService,
      jobs as never,
    );

    await service.triggerManual('owner-1', 'topic-1', 'request-123');
    repo.createManualRun.mockResolvedValueOnce({
      run: { id: 'run-manual' },
      created: false,
    });
    await service.triggerManual('owner-1', 'topic-1', 'request-123');

    expect(repo.createManualRun).toHaveBeenCalledWith(
      'owner-1',
      'topic-1',
      'request-123',
    );
    expect(jobs.add).toHaveBeenCalledTimes(1);
    expect(jobs.add).toHaveBeenCalledWith(
      'run',
      { runId: 'run-manual' },
      expect.objectContaining({ jobId: 'run-manual' }),
    );
  });

  it('cancels only an owned Run and forks without copying private execution state', async () => {
    const repo = repository();
    const jobs = queue();
    const service = new TopicService(
      repo as unknown as TopicRepositoryService,
      jobs as never,
    );

    await service.cancelRun('owner-1', 'topic-1', 'run-manual');
    const fork = await service.fork('user-2', 'public-topic');

    expect(repo.cancelOwnedRun).toHaveBeenCalledWith(
      'owner-1',
      'topic-1',
      'run-manual',
    );
    expect(repo.forkPublic).toHaveBeenCalledWith('user-2', 'public-topic');
    expect(jobs.add).toHaveBeenCalledWith(
      'run',
      { runId: 'run-fork' },
      expect.objectContaining({ jobId: 'run-fork' }),
    );
    expect(fork.topic).toEqual({ id: 'topic-fork' });
  });
});
