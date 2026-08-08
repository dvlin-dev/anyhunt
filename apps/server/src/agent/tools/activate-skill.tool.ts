/**
 * [INPUT]: Attached Skill ID and optional standard package path
 * [OUTPUT]: Current immutable Attached Skill file
 * [POS]: Read-only, Topic-scoped Skill activation Tool
 */

import type { JsonValue } from '@prisma/client/runtime/client';
import { z } from 'zod';
import type { SkillService } from '../skills/skill.service';
import type { RegisteredAgentToolDefinition } from './agent-tool-registry.service';

const SkillPathSchema = z
  .string()
  .max(512)
  .refine((value) => {
    if (value === 'SKILL.md') return true;
    if (value.includes('\\') || value.includes('\0')) return false;
    const segments = value.split('/');
    return (
      (segments[0] === 'references' || segments[0] === 'assets') &&
      segments.length >= 2 &&
      segments.every(
        (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
      )
    );
  }, 'Path must address SKILL.md, references/, or assets/');

const ActivateSkillInputSchema = z.object({
  skillId: z.string().trim().min(1).max(128),
  path: SkillPathSchema.default('SKILL.md'),
});

type ActivateSkillInput = z.infer<typeof ActivateSkillInputSchema>;

function textFiles(value: JsonValue): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Stored Skill package is invalid');
  }
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (typeof content !== 'string') {
      throw new Error('Stored Skill package is invalid');
    }
    files[path] = content;
  }
  return files;
}

export interface ActivatedSkillVersion {
  skillId: string;
  versionId: string;
  version: number;
}

export class ActivatedSkillStore {
  private readonly versions = new Map<
    string,
    Map<string, ActivatedSkillVersion>
  >();

  record(runId: string, value: ActivatedSkillVersion): void {
    const run =
      this.versions.get(runId) ?? new Map<string, ActivatedSkillVersion>();
    run.set(value.skillId, { ...value });
    this.versions.set(runId, run);
  }

  snapshot(runId: string): readonly ActivatedSkillVersion[] {
    return [...(this.versions.get(runId)?.values() ?? [])].map((value) => ({
      ...value,
    }));
  }

  delete(runId: string): void {
    this.versions.delete(runId);
  }

  initialize(
    runId: string,
    values: readonly ActivatedSkillVersion[] = [],
  ): void {
    this.delete(runId);
    for (const value of values) this.record(runId, value);
  }
}

export function createActivateSkillTool(
  skillService: Pick<SkillService, 'getAttachedVersion'>,
  topicIdForRun: (runId: string) => string,
  activatedSkills: ActivatedSkillStore,
): RegisteredAgentToolDefinition<ActivateSkillInput, unknown> {
  return {
    name: 'activate_skill',
    description:
      'Read the current version of a Skill already attached to this Topic. Start with SKILL.md.',
    inputSchema: ActivateSkillInputSchema,
    permission: 'skill.read',
    timeoutMs: 5_000,
    maxResultChars: 25_000,
    execute: async ({ skillId, path }, context) => {
      const { skill, version } = await skillService.getAttachedVersion(
        topicIdForRun(context.runId),
        skillId,
      );
      const files = textFiles(version.files);
      const content = files[path];
      if (content === undefined) throw new Error('Skill file not found');
      activatedSkills.record(context.runId, {
        skillId: skill.id,
        versionId: version.id,
        version: version.version,
      });
      return {
        skillId: skill.id,
        name: skill.name,
        version: version.version,
        path,
        content,
        availableFiles: Object.keys(files).sort(),
      };
    },
  };
}
