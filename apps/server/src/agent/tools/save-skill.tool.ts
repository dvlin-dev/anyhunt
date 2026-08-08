/**
 * [INPUT]: Agent-generated standard SKILL.md
 * [OUTPUT]: Immutable version of the current Topic Managed Skill
 * [POS]: Terminal Tool with no caller-selected Topic or Skill target
 */

import { z } from 'zod';
import type { SkillPackageService } from '../skills/skill-package.service';
import type { SkillService } from '../skills/skill.service';
import type { RegisteredAgentToolDefinition } from './agent-tool-registry.service';

const SaveSkillInputSchema = z.object({
  skillMarkdown: z
    .string()
    .min(1)
    .max(20_000)
    .describe(
      'Raw SKILL.md without a code fence. It must begin with YAML frontmatter containing a lowercase-hyphen name and a non-empty description, followed by reusable Markdown instructions.',
    ),
});

type SaveSkillInput = z.infer<typeof SaveSkillInputSchema>;

export function createSaveSkillTool(
  packages: Pick<SkillPackageService, 'parseGeneratedSkill'>,
  skills: Pick<SkillService, 'saveManagedVersion'>,
  topicIdForRun: (runId: string) => string,
): RegisteredAgentToolDefinition<SaveSkillInput, unknown> {
  return {
    name: 'save_skill',
    description:
      'Save reusable research experience as the current Topic Managed Skill. Pass raw SKILL.md without a code fence: start with YAML frontmatter delimited by --- containing name (lowercase letters, numbers, and single hyphens only) and description, then concise reusable Markdown instructions.',
    inputSchema: SaveSkillInputSchema,
    permission: 'skill.write',
    timeoutMs: 10_000,
    maxResultChars: 2_000,
    execute: async ({ skillMarkdown }, context) => {
      const parsed = packages.parseGeneratedSkill(skillMarkdown);
      const result = await skills.saveManagedVersion(
        topicIdForRun(context.runId),
        parsed,
      );
      return {
        saved: true,
        skillId: result.skill.id,
        versionId: result.version.id,
        version: result.version.version,
        contentHash: result.version.contentHash,
      };
    },
  };
}
