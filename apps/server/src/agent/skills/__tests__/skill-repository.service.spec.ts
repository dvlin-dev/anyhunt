import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ParsedSkillPackage } from '../skill-package.schema';
import { SkillRepositoryService } from '../skill-repository.service';

const parsedPackage: ParsedSkillPackage = {
  name: 'research-sources',
  description: 'Finds reliable sources.',
  files: { 'SKILL.md': 'content' },
  contentHash: 'a'.repeat(64),
};

describe('SkillRepositoryService', () => {
  it('returns the existing SkillVersion for a repeated owner/hash import', async () => {
    const existing = {
      id: 'version-1',
      skillId: 'skill-1',
      version: 1,
      files: parsedPackage.files,
      contentHash: parsedPackage.contentHash,
      createdAt: new Date(),
      skill: { id: 'skill-1', ownerId: 'user-1' },
    };
    const prisma = {
      skillVersion: {
        findFirst: vi.fn().mockResolvedValue(existing),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaService;

    const result = await new SkillRepositoryService(prisma).importSkill({
      ownerId: 'user-1',
      package: parsedPackage,
      sourceUrl: null,
    });

    expect(result).toMatchObject({ created: false, version: existing });
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  it('creates an imported Skill disabled with immutable version 1', async () => {
    const skill = {
      id: 'skill-1',
      ownerId: 'user-1',
      name: parsedPackage.name,
      enabled: false,
      currentVersion: 1,
    };
    const version = {
      id: 'version-1',
      skillId: skill.id,
      version: 1,
      files: parsedPackage.files,
      contentHash: parsedPackage.contentHash,
      sourceUrl: 'https://skills.example.com/research.zip',
    };
    const transaction = {
      skill: { create: vi.fn().mockResolvedValue(skill) },
      skillVersion: { create: vi.fn().mockResolvedValue(version) },
    };
    const prisma = {
      skillVersion: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi
        .fn()
        .mockImplementation((callback) => callback(transaction)),
    } as unknown as PrismaService;

    const result = await new SkillRepositoryService(prisma).importSkill({
      ownerId: 'user-1',
      package: parsedPackage,
      sourceUrl: version.sourceUrl,
    });

    expect(result).toMatchObject({ created: true, skill, version });
    expect(transaction.skill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enabled: false, currentVersion: 1 }),
      }),
    );
  });

  it('appends a new immutable version after the highest historical version', async () => {
    const ownedSkill = {
      id: 'skill-1',
      ownerId: 'user-1',
      currentVersion: 2,
      versions: [],
    };
    const version = {
      id: 'version-4',
      skillId: 'skill-1',
      version: 4,
      files: parsedPackage.files,
      contentHash: parsedPackage.contentHash,
    };
    const transaction = {
      skillVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _max: { version: 3 } }),
        create: vi.fn().mockResolvedValue(version),
      },
      skill: {
        update: vi.fn().mockResolvedValue({
          ...ownedSkill,
          currentVersion: 4,
        }),
      },
    };
    const prisma = {
      skill: { findFirst: vi.fn().mockResolvedValue(ownedSkill) },
      $transaction: vi
        .fn()
        .mockImplementation((callback) => callback(transaction)),
    } as unknown as PrismaService;

    const result = await new SkillRepositoryService(prisma).addVersion({
      ownerId: 'user-1',
      skillId: 'skill-1',
      package: parsedPackage,
      sourceUrl: null,
    });

    expect(result).toMatchObject({ created: true, version: { version: 4 } });
    expect(transaction.skillVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 4 }),
      }),
    );
  });

  it('fails closed before rollback when the Skill is not owned', async () => {
    const prisma = {
      skill: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      skillVersion: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await expect(
      new SkillRepositoryService(prisma).rollback('user-2', 'skill-1', 1),
    ).rejects.toMatchObject({ status: 404 });
    expect((prisma as any).skill.update).not.toHaveBeenCalled();
  });

  it('enforces the 20 Attached Skill limit without duplicating an existing link', async () => {
    const transaction = {
      topic: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'topic-1',
          attachedSkills: [],
          _count: { attachedSkills: 20 },
        }),
        update: vi.fn(),
      },
      skill: {
        findFirst: vi.fn().mockResolvedValue({ id: 'skill-21' }),
      },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation((callback) => callback(transaction)),
    } as unknown as PrismaService;
    const repository = new SkillRepositoryService(prisma);

    await expect(
      repository.attachToTopic('user-1', 'topic-1', 'skill-21'),
    ).rejects.toMatchObject({ status: 400 });
    expect(transaction.topic.update).not.toHaveBeenCalled();

    transaction.topic.findFirst.mockResolvedValue({
      id: 'topic-1',
      attachedSkills: [{ id: 'skill-21' }],
      _count: { attachedSkills: 20 },
    });
    await expect(
      repository.attachToTopic('user-1', 'topic-1', 'skill-21'),
    ).resolves.toMatchObject({ id: 'topic-1' });
    expect(transaction.topic.update).not.toHaveBeenCalled();
  });

  it('writes Agent experience only to the Topic current Managed Skill', async () => {
    const managedSkill = {
      id: 'managed-skill',
      ownerId: 'user-1',
      currentVersion: 1,
    };
    const version = {
      id: 'managed-version-2',
      skillId: managedSkill.id,
      version: 2,
      contentHash: parsedPackage.contentHash,
    };
    const transaction = {
      topic: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'topic-1',
          ownerId: 'user-1',
          managedSkillId: managedSkill.id,
        }),
      },
      skill: {
        findFirst: vi.fn().mockResolvedValue(managedSkill),
        update: vi.fn().mockResolvedValue({
          ...managedSkill,
          currentVersion: 2,
        }),
      },
      skillVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _max: { version: 1 } }),
        create: vi.fn().mockResolvedValue(version),
      },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation((callback) => callback(transaction)),
    } as unknown as PrismaService;

    const result = await new SkillRepositoryService(prisma).saveManagedVersion(
      'topic-1',
      parsedPackage,
    );

    expect(result).toMatchObject({
      createdSkill: false,
      version: { skillId: 'managed-skill', version: 2 },
    });
    expect(transaction.skillVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ skillId: 'managed-skill' }),
      }),
    );
  });
});
