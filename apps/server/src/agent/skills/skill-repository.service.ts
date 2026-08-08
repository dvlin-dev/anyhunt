/**
 * [INPUT]: Validated Skill packages and owner-scoped commands
 * [OUTPUT]: Skill/SkillVersion persistence with immutable version history
 * [POS]: The only Prisma access layer for Agent Skills
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma-main/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ParsedSkillPackage } from './skill-package.schema';

interface ImportSkillInput {
  ownerId: string;
  package: ParsedSkillPackage;
  sourceUrl: string | null;
}

const skillSummarySelect = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  enabled: true,
  currentVersion: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SkillSelect;

function asJson(files: Record<string, string>): Prisma.InputJsonValue {
  return files;
}

@Injectable()
export class SkillRepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  listOwned(ownerId: string) {
    return this.prisma.skill.findMany({
      where: { ownerId, archivedAt: null },
      select: skillSummarySelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async getOwned(ownerId: string, skillId: string) {
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, ownerId, archivedAt: null },
      select: {
        ...skillSummarySelect,
        versions: { orderBy: { version: 'desc' } },
      },
    });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  async getCurrentVersion(ownerId: string, skillId: string) {
    const skill = await this.getOwned(ownerId, skillId);
    const version = skill.versions.find(
      (candidate) => candidate.version === skill.currentVersion,
    );
    if (!version) throw new NotFoundException('Skill version not found');
    return { skill, version };
  }

  async importSkill(input: ImportSkillInput) {
    const existing = await this.prisma.skillVersion.findFirst({
      where: {
        contentHash: input.package.contentHash,
        skill: { ownerId: input.ownerId, archivedAt: null },
      },
      include: { skill: true },
    });
    if (existing) {
      return {
        created: false as const,
        skill: existing.skill,
        version: existing,
      };
    }

    return this.prisma.$transaction(async (transaction) => {
      const skill = await transaction.skill.create({
        data: {
          ownerId: input.ownerId,
          name: input.package.name,
          description: input.package.description,
          enabled: false,
          currentVersion: 1,
        },
      });
      const version = await transaction.skillVersion.create({
        data: {
          skillId: skill.id,
          version: 1,
          files: asJson(input.package.files),
          contentHash: input.package.contentHash,
          sourceUrl: input.sourceUrl,
        },
      });
      return { created: true as const, skill, version };
    });
  }

  async addVersion(input: ImportSkillInput & { skillId: string }) {
    await this.getOwned(input.ownerId, input.skillId);

    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.skillVersion.findFirst({
        where: {
          skillId: input.skillId,
          contentHash: input.package.contentHash,
        },
      });
      if (existing) {
        const skill = await transaction.skill.update({
          where: { id: input.skillId },
          data: { currentVersion: existing.version },
        });
        return { created: false as const, skill, version: existing };
      }

      const latest = await transaction.skillVersion.aggregate({
        where: { skillId: input.skillId },
        _max: { version: true },
      });
      const nextVersion = (latest._max.version ?? 0) + 1;
      const version = await transaction.skillVersion.create({
        data: {
          skillId: input.skillId,
          version: nextVersion,
          files: asJson(input.package.files),
          contentHash: input.package.contentHash,
          sourceUrl: input.sourceUrl,
        },
      });
      const skill = await transaction.skill.update({
        where: { id: input.skillId },
        data: {
          name: input.package.name,
          description: input.package.description,
          currentVersion: nextVersion,
        },
      });
      return { created: true as const, skill, version };
    });
  }

  async setEnabled(ownerId: string, skillId: string, enabled: boolean) {
    await this.getOwned(ownerId, skillId);
    return this.prisma.skill.update({
      where: { id: skillId },
      data: { enabled },
      select: skillSummarySelect,
    });
  }

  async rollback(ownerId: string, skillId: string, version: number) {
    await this.getOwned(ownerId, skillId);
    const exists = await this.prisma.skillVersion.findUnique({
      where: { skillId_version: { skillId, version } },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Skill version not found');

    return this.prisma.skill.update({
      where: { id: skillId },
      data: { currentVersion: version },
      select: skillSummarySelect,
    });
  }

  async archive(ownerId: string, skillId: string) {
    await this.getOwned(ownerId, skillId);
    return this.prisma.skill.update({
      where: { id: skillId },
      data: { archivedAt: new Date(), enabled: false },
      select: skillSummarySelect,
    });
  }

  async attachToTopic(ownerId: string, topicId: string, skillId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        const [topic, skill] = await Promise.all([
          transaction.topic.findFirst({
            where: { id: topicId, ownerId },
            select: {
              id: true,
              attachedSkills: {
                where: { id: skillId },
                select: { id: true },
              },
              _count: { select: { attachedSkills: true } },
            },
          }),
          transaction.skill.findFirst({
            where: {
              id: skillId,
              ownerId,
              enabled: true,
              archivedAt: null,
            },
            select: { id: true },
          }),
        ]);
        if (!topic) throw new NotFoundException('Topic not found');
        if (!skill) throw new NotFoundException('Enabled Skill not found');
        if (topic.attachedSkills.length > 0) return topic;
        if (topic._count.attachedSkills >= 20) {
          throw new BadRequestException('A Topic can attach at most 20 Skills');
        }

        return transaction.topic.update({
          where: { id: topicId },
          data: { attachedSkills: { connect: { id: skillId } } },
          select: {
            id: true,
            attachedSkills: { select: skillSummarySelect },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async detachFromTopic(ownerId: string, topicId: string, skillId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, ownerId },
      select: { id: true },
    });
    if (!topic) throw new NotFoundException('Topic not found');

    return this.prisma.topic.update({
      where: { id: topicId },
      data: { attachedSkills: { disconnect: { id: skillId } } },
      select: {
        id: true,
        attachedSkills: { select: skillSummarySelect },
      },
    });
  }

  async getTopicSkillCatalog(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        managedSkill: {
          where: { enabled: true, archivedAt: null },
          select: skillSummarySelect,
        },
        attachedSkills: {
          where: { enabled: true, archivedAt: null },
          select: skillSummarySelect,
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  async getAttachedVersion(topicId: string, skillId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: {
        id: topicId,
        attachedSkills: {
          some: { id: skillId, enabled: true, archivedAt: null },
        },
      },
      select: {
        attachedSkills: {
          where: { id: skillId },
          select: { id: true, name: true, currentVersion: true },
        },
      },
    });
    const skill = topic?.attachedSkills[0];
    if (!skill) throw new NotFoundException('Attached Skill not found');

    const version = await this.prisma.skillVersion.findUnique({
      where: {
        skillId_version: {
          skillId: skill.id,
          version: skill.currentVersion,
        },
      },
    });
    if (!version) throw new NotFoundException('Skill version not found');
    return { skill, version };
  }

  async getManagedVersion(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: {
        managedSkill: {
          where: { enabled: true, archivedAt: null },
          select: { id: true, name: true, currentVersion: true },
        },
      },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    if (!topic.managedSkill) return null;
    const version = await this.prisma.skillVersion.findUnique({
      where: {
        skillId_version: {
          skillId: topic.managedSkill.id,
          version: topic.managedSkill.currentVersion,
        },
      },
    });
    if (!version)
      throw new NotFoundException('Managed Skill version not found');
    return { skill: topic.managedSkill, version };
  }

  async saveManagedVersion(topicId: string, package_: ParsedSkillPackage) {
    return this.prisma.$transaction(async (transaction) => {
      const topic = await transaction.topic.findUnique({
        where: { id: topicId },
        select: { id: true, ownerId: true, managedSkillId: true },
      });
      if (!topic) throw new NotFoundException('Topic not found');

      if (!topic.managedSkillId) {
        const skill = await transaction.skill.create({
          data: {
            ownerId: topic.ownerId,
            name: package_.name,
            description: package_.description,
            enabled: true,
            currentVersion: 1,
          },
        });
        const version = await transaction.skillVersion.create({
          data: {
            skillId: skill.id,
            version: 1,
            files: asJson(package_.files),
            contentHash: package_.contentHash,
            sourceUrl: null,
          },
        });
        await transaction.topic.update({
          where: { id: topic.id },
          data: { managedSkillId: skill.id },
        });
        return { createdSkill: true as const, skill, version };
      }

      const managedSkill = await transaction.skill.findFirst({
        where: {
          id: topic.managedSkillId,
          ownerId: topic.ownerId,
          archivedAt: null,
        },
      });
      if (!managedSkill) {
        throw new NotFoundException('Managed Skill not found');
      }
      const existing = await transaction.skillVersion.findFirst({
        where: {
          skillId: managedSkill.id,
          contentHash: package_.contentHash,
        },
      });
      if (existing) {
        return {
          createdSkill: false as const,
          skill: managedSkill,
          version: existing,
        };
      }

      const latest = await transaction.skillVersion.aggregate({
        where: { skillId: managedSkill.id },
        _max: { version: true },
      });
      const nextVersion = (latest._max.version ?? 0) + 1;
      const version = await transaction.skillVersion.create({
        data: {
          skillId: managedSkill.id,
          version: nextVersion,
          files: asJson(package_.files),
          contentHash: package_.contentHash,
          sourceUrl: null,
        },
      });
      const skill = await transaction.skill.update({
        where: { id: managedSkill.id },
        data: {
          name: package_.name,
          description: package_.description,
          currentVersion: nextVersion,
        },
      });
      return { createdSkill: false as const, skill, version };
    });
  }
}
