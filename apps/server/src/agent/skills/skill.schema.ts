/**
 * [DEFINES]: User-facing Skill command schemas
 * [USED_BY]: Skill controller
 * [POS]: Validation boundary for Skill import, status, and rollback commands
 */

import { z } from 'zod';

export const SkillUrlImportSchema = z
  .object({
    url: z.string().trim().url().startsWith('https://').max(2_048),
  })
  .strict();

export const SkillStatusSchema = z.object({ enabled: z.boolean() }).strict();

export const SkillRollbackSchema = z
  .object({ version: z.number().int().positive() })
  .strict();

export type SkillUrlImportDto = z.infer<typeof SkillUrlImportSchema>;
export type SkillStatusDto = z.infer<typeof SkillStatusSchema>;
export type SkillRollbackDto = z.infer<typeof SkillRollbackSchema>;
