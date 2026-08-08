import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user.service';

describe('account deletion integration', () => {
  let prisma: PrismaService;
  const cleanupUserIds: string[] = [];
  const cleanupDeletionHashes: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (cleanupUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    if (cleanupDeletionHashes.length > 0) {
      await prisma.accountDeletionRecord.deleteMany({
        where: { userIdHash: { in: cleanupDeletionHashes } },
      });
    }
    await prisma.$disconnect();
  });

  it('removes the complete user-owned graph and preserves only anonymized operational records', async () => {
    const suffix = randomUUID();
    const userId = `delete-user-${suffix}`;
    const email = `delete-${suffix}@example.com`;
    const topicId = `delete-topic-${suffix}`;
    const skillId = `delete-skill-${suffix}`;
    const runId = `delete-run-${suffix}`;
    const userIdHash = createHash('sha256').update(userId).digest('hex');
    cleanupUserIds.push(userId);
    cleanupDeletionHashes.push(userIdHash);

    await prisma.user.create({
      data: {
        id: userId,
        email,
        accounts: {
          create: {
            id: `delete-account-${suffix}`,
            accountId: email,
            providerId: 'credential',
          },
        },
        sessions: {
          create: {
            id: `delete-session-${suffix}`,
            token: `delete-token-${suffix}`,
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    await prisma.skill.create({
      data: {
        id: skillId,
        ownerId: userId,
        name: 'Deletion test skill',
        description: 'Owned by the account under deletion.',
        versions: {
          create: {
            version: 1,
            files: { 'SKILL.md': '# Test' },
            contentHash: createHash('sha256').update(suffix).digest('hex'),
          },
        },
      },
    });
    await prisma.topic.create({
      data: {
        id: topicId,
        ownerId: userId,
        slug: `delete-${suffix}`,
        title: 'Deletion test topic',
        goal: 'Verify database cascades.',
        cron: '0 * * * *',
        timezone: 'UTC',
        managedSkillId: skillId,
        attachedSkills: { connect: { id: skillId } },
      },
    });
    const subscription = await prisma.subscription.create({
      data: { userId, topicId },
    });
    await prisma.run.create({
      data: {
        id: runId,
        topicId,
        runKey: `${topicId}:MANUAL:deletion`,
        trigger: 'MANUAL',
        scheduledAt: new Date(),
        items: {
          create: {
            canonicalUrlHash: createHash('sha256')
              .update(`https://example.com/${suffix}`)
              .digest('hex'),
            title: 'Deletion evidence',
            url: `https://example.com/${suffix}`,
            summary: 'This row must be deleted with the run.',
            selectionReason: 'Integration coverage.',
            rank: 1,
            retrievedAt: new Date(),
            contentHash: createHash('sha256')
              .update(`content-${suffix}`)
              .digest('hex'),
          },
        },
        deliveries: {
          create: {
            subscriptionId: subscription.id,
            channel: 'EMAIL',
          },
        },
      },
    });
    await prisma.userItemState.create({
      data: {
        userId,
        canonicalUrlHash: createHash('sha256')
          .update(`state-${suffix}`)
          .digest('hex'),
        savedAt: new Date(),
      },
    });
    const requestLog = await prisma.requestLog.create({
      data: {
        requestId: `request-${suffix}`,
        method: 'DELETE',
        path: '/api/v1/users/me',
        statusCode: 204,
        durationMs: 12,
        userId,
        clientIp: '203.0.113.8',
        forwardedFor: '203.0.113.8',
        origin: 'https://example.com',
        referer: 'https://example.com/settings',
        userAgent: 'integration-test',
      },
    });
    const auditLog = await prisma.adminAuditLog.create({
      data: {
        actorUserId: userId,
        targetUserId: userId,
        action: 'account.delete',
        reason: 'Integration verification',
      },
    });

    await new UserService(prisma).deleteAccount(userId, {
      confirmation: email,
      reason: 'other',
      feedback: 'Integration verification.',
    });

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.topic.count({ where: { id: topicId } })).toBe(0);
    expect(await prisma.skill.count({ where: { id: skillId } })).toBe(0);
    expect(await prisma.run.count({ where: { id: runId } })).toBe(0);
    expect(await prisma.subscription.count({ where: { userId } })).toBe(0);
    expect(await prisma.userItemState.count({ where: { userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect(await prisma.account.count({ where: { userId } })).toBe(0);
    expect(
      await prisma.accountDeletionRecord.findUnique({
        where: { userIdHash },
      }),
    ).toMatchObject({
      userIdHash,
      emailHash: createHash('sha256').update(email.toLowerCase()).digest('hex'),
      reason: 'other',
    });
    expect(
      await prisma.requestLog.findUnique({ where: { id: requestLog.id } }),
    ).toMatchObject({
      userId: null,
      clientIp: 'anonymized',
      forwardedFor: null,
      origin: null,
      referer: null,
      userAgent: null,
    });
    expect(
      await prisma.adminAuditLog.findUnique({ where: { id: auditLog.id } }),
    ).toMatchObject({ actorUserId: 'deleted-user', targetUserId: null });
  });
});
