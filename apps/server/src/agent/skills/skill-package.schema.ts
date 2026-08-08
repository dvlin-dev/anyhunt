/**
 * [DEFINES]: Agent Skills package metadata, limits, and normalized persistence shape
 * [USED_BY]: Skill package parser, repository, API, and activate_skill Tool
 * [POS]: Single source of truth for the supported Agent Skills safety subset
 */

import { z } from 'zod';

export const SKILL_PACKAGE_LIMITS = {
  archiveBytes: 1_048_576,
  uncompressedBytes: 262_144,
  files: 64,
  pathDepth: 4,
  compressionRatio: 100,
  skillMarkdownLines: 500,
  skillMarkdownCharacters: 20_000,
} as const;

export const SkillNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Skill name must use lowercase letters, numbers, and single hyphens',
  );

export const SkillFrontmatterSchema = z
  .object({
    name: SkillNameSchema,
    description: z.string().trim().min(1).max(1_024),
  })
  .passthrough();

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface ParsedSkillPackage {
  name: string;
  description: string;
  files: Record<string, string>;
  contentHash: string;
}
