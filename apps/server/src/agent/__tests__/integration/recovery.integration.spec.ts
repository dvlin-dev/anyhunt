import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseRedisUrl } from '../../../queue/queue.utils';
import { TopicRepositoryService } from '../../../topic/topic.repository.service';
import { AgentCheckpointService } from '../../runtime/agent-checkpoint.service';

describe('Agent Run queue and recovery integration', () => {
  let prisma: PrismaService;
  const ownedUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (ownedUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ownedUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('deduplicates one Run job and lets only one of two Workers execute it', async () => {
    const queueName = `integration-run-${randomUUID()}`;
    const connection = {
      ...parseRedisUrl(process.env.REDIS_URL!),
      maxRetriesPerRequest: null,
    };
    const queue = new Queue(queueName, { connection });
    const events = new QueueEvents(queueName, { connection });
    await events.waitUntilReady();
    let executions = 0;

    try {
      const [first, duplicate] = await Promise.all([
        queue.add('run', { runId: 'run-1' }, { jobId: 'run-1' }),
        queue.add('run', { runId: 'run-1' }, { jobId: 'run-1' }),
      ]);
      expect(first.id).toBe('run-1');
      expect(duplicate.id).toBe('run-1');
      expect(await queue.getJobCounts('waiting')).toMatchObject({ waiting: 1 });

      const process = async () => {
        executions += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'done';
      };
      const workers = [
        new Worker(queueName, process, { connection, concurrency: 1 }),
        new Worker(queueName, process, { connection, concurrency: 1 }),
      ];
      await Promise.all(workers.map((worker) => worker.waitUntilReady()));
      await first.waitUntilFinished(events, 10_000);
      await Promise.all(workers.map((worker) => worker.close()));

      expect(executions).toBe(1);
      expect(await queue.getJobCounts('completed')).toMatchObject({
        completed: 1,
      });
    } finally {
      await queue.obliterate({ force: true }).catch(() => undefined);
      await events.close();
      await queue.close();
    }
  });

  it('persists a bounded checkpoint across process loss and keeps cancellation idempotent', async () => {
    const suffix = randomUUID();
    const userId = `user-${suffix}`;
    const topicId = `topic-${suffix}`;
    const runId = `run-${suffix}`;
    ownedUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@example.com` },
    });
    await prisma.topic.create({
      data: {
        id: topicId,
        ownerId: userId,
        slug: `topic-${suffix}`,
        title: 'Recovery',
        goal: 'Verify recovery.',
        cron: '0 * * * *',
        timezone: 'UTC',
      },
    });
    await prisma.run.create({
      data: {
        id: runId,
        topicId,
        runKey: `${topicId}:MANUAL:recovery`,
        trigger: 'MANUAL',
        status: 'RUNNING',
        scheduledAt: new Date(),
        startedAt: new Date(),
      },
    });
    const checkpoints = new AgentCheckpointService(prisma);
    await checkpoints.save(runId, {
      version: 1,
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Public progress.' },
            { type: 'thinking', thinking: 'must not persist' },
          ],
        },
      ],
      completedToolCallIds: ['call-1', 'call-1'],
      evidence: [],
      budget: {
        turns: 1,
        toolCalls: 1,
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0.01,
        elapsedMs: 100,
      },
      activatedSkillVersions: [],
      submitted: false,
    });

    await prisma.$disconnect();
    prisma = new PrismaService();
    await prisma.$connect();
    const recovered = await new AgentCheckpointService(prisma).load(runId);
    expect(recovered).toMatchObject({
      version: 1,
      completedToolCallIds: ['call-1'],
      budget: { turns: 1, toolCalls: 1 },
    });
    expect(JSON.stringify(recovered)).not.toContain('must not persist');

    const repository = new TopicRepositoryService(prisma);
    const cancellation = await Promise.allSettled([
      repository.cancelOwnedRun(userId, topicId, runId),
      repository.cancelOwnedRun(userId, topicId, runId),
    ]);
    expect(cancellation.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(cancellation.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    );
    await expect(
      prisma.run.findUniqueOrThrow({ where: { id: runId } }),
    ).resolves.toMatchObject({ status: 'RUNNING' });
    expect(
      (await prisma.run.findUniqueOrThrow({ where: { id: runId } }))
        .cancelRequestedAt,
    ).toBeInstanceOf(Date);
  });
});
