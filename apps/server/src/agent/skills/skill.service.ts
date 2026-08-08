/**
 * [INPUT]: Owner-scoped Skill commands and validated package sources
 * [OUTPUT]: Skill CRUD, immutable versions, rollback, and standard ZIP export
 * [POS]: Application service for user-managed Agent Skills
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { strToU8, zipSync } from 'fflate';
import type { JsonValue } from '@prisma/client/runtime/client';
import {
  SkillPackageError,
  SkillPackageService,
} from './skill-package.service';
import type { ParsedSkillPackage } from './skill-package.schema';
import { SkillRepositoryService } from './skill-repository.service';

function packageFailure(error: unknown): never {
  if (error instanceof SkillPackageError) {
    throw new BadRequestException({ code: error.code, message: error.message });
  }
  throw error;
}

function filesFromJson(value: JsonValue): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequestException('Stored Skill package is invalid');
  }

  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (typeof content !== 'string') {
      throw new BadRequestException('Stored Skill package is invalid');
    }
    files[path] = content;
  }
  return files;
}

@Injectable()
export class SkillService {
  constructor(
    private readonly packages: SkillPackageService,
    private readonly repository: SkillRepositoryService,
  ) {}

  list(ownerId: string) {
    return this.repository.listOwned(ownerId);
  }

  get(ownerId: string, skillId: string) {
    return this.repository.getOwned(ownerId, skillId);
  }

  async importZip(ownerId: string, archive: Uint8Array) {
    let parsed: ParsedSkillPackage;
    try {
      parsed = this.packages.parseZip(archive);
    } catch (error) {
      packageFailure(error);
    }
    return this.repository.importSkill({
      ownerId,
      package: parsed,
      sourceUrl: null,
    });
  }

  async importFromUrl(ownerId: string, url: string, signal?: AbortSignal) {
    let parsed: ParsedSkillPackage;
    try {
      parsed = await this.packages.importFromUrl(url, signal);
    } catch (error) {
      packageFailure(error);
    }
    return this.repository.importSkill({
      ownerId,
      package: parsed,
      sourceUrl: new URL(url).toString(),
    });
  }

  async updateFromUrl(
    ownerId: string,
    skillId: string,
    url: string,
    signal?: AbortSignal,
  ) {
    const current = await this.repository.getOwned(ownerId, skillId);
    let parsed: ParsedSkillPackage;
    try {
      parsed = await this.packages.importFromUrl(url, signal);
    } catch (error) {
      packageFailure(error);
    }
    if (parsed.name !== current.name) {
      throw new BadRequestException(
        'Updated Skill package name must match the existing Skill',
      );
    }

    return this.repository.addVersion({
      ownerId,
      skillId,
      package: parsed,
      sourceUrl: new URL(url).toString(),
    });
  }

  setEnabled(ownerId: string, skillId: string, enabled: boolean) {
    return this.repository.setEnabled(ownerId, skillId, enabled);
  }

  rollback(ownerId: string, skillId: string, version: number) {
    return this.repository.rollback(ownerId, skillId, version);
  }

  archive(ownerId: string, skillId: string) {
    return this.repository.archive(ownerId, skillId);
  }

  async exportZip(ownerId: string, skillId: string): Promise<Uint8Array> {
    const { skill, version } = await this.repository.getCurrentVersion(
      ownerId,
      skillId,
    );
    const files = filesFromJson(version.files);
    const entries = Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        `${skill.name}/${path}`,
        strToU8(content),
      ]),
    );
    return zipSync(entries, { level: 6 });
  }

  attachToTopic(ownerId: string, topicId: string, skillId: string) {
    return this.repository.attachToTopic(ownerId, topicId, skillId);
  }

  detachFromTopic(ownerId: string, topicId: string, skillId: string) {
    return this.repository.detachFromTopic(ownerId, topicId, skillId);
  }

  getTopicSkillCatalog(topicId: string) {
    return this.repository.getTopicSkillCatalog(topicId);
  }

  getAttachedVersion(topicId: string, skillId: string) {
    return this.repository.getAttachedVersion(topicId, skillId);
  }

  getManagedVersion(topicId: string) {
    return this.repository.getManagedVersion(topicId);
  }

  saveManagedVersion(topicId: string, package_: ParsedSkillPackage) {
    return this.repository.saveManagedVersion(topicId, package_);
  }
}
