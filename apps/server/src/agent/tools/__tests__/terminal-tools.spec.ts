import { describe, expect, it, vi } from 'vitest';
import type { UrlValidator } from '../../../common/validators/url.validator';
import { SkillPackageService } from '../../skills/skill-package.service';
import type { SkillService } from '../../skills/skill.service';
import {
  ActivatedSkillStore,
  createActivateSkillTool,
} from '../activate-skill.tool';
import {
  AgentToolRegistryService,
  type RegisteredAgentToolDefinition,
} from '../agent-tool-registry.service';
import { EvidenceLedgerStore } from '../evidence-ledger';
import { createSaveSkillTool } from '../save-skill.tool';
import {
  createSubmitDigestTool,
  DigestSubmissionStore,
} from '../submit-digest.tool';

function resolve(tool: RegisteredAgentToolDefinition) {
  const registry = new AgentToolRegistryService();
  registry.register(tool);
  registry.freeze();
  return registry.resolveTool(tool.name, {
    allowedPermissions: new Set([tool.permission]),
  });
}

function context(runId = 'run-1') {
  return {
    runId,
    toolCallId: 'call-1',
    signal: new AbortController().signal,
  };
}

describe('submit_digest', () => {
  it('accepts only evidence from the current Run and is idempotent', async () => {
    const ledgers = new EvidenceLedgerStore();
    ledgers.create('run-1').record({
      url: 'https://example.com/article?a=1&b=2',
      title: 'Article',
      content: 'Evidence',
      toolName: 'web_fetch',
    });
    ledgers.create('run-2').record({
      url: 'https://example.com/other',
      content: 'Other',
      toolName: 'web_fetch',
    });
    const submissions = new DigestSubmissionStore();
    const tool = resolve(createSubmitDigestTool(ledgers, submissions));
    const input = {
      narrative: 'What changed.',
      items: [
        {
          url: 'https://example.com/article?b=2&a=1#fragment',
          title: 'Article',
          summary: 'Evidence summary.',
          selectionReason: 'Directly relevant.',
        },
      ],
    };

    await expect(tool.execute(input, context())).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
      itemCount: 1,
    });
    await expect(tool.execute(input, context())).resolves.toMatchObject({
      duplicate: true,
    });
    expect(submissions.get('run-1')?.items[0]?.url).toBe(
      'https://example.com/article?a=1&b=2',
    );

    const secondRunTool = resolve(createSubmitDigestTool(ledgers, submissions));
    await expect(
      secondRunTool.execute(input, context('run-2')),
    ).rejects.toMatchObject({ code: 'EXECUTION_FAILED' });
  });

  it('rejects duplicate normalized URLs', async () => {
    const ledgers = new EvidenceLedgerStore();
    ledgers.create('run-1').record({
      url: 'https://example.com/article?a=1&b=2',
      content: 'Evidence',
      toolName: 'web_search',
    });
    const tool = resolve(
      createSubmitDigestTool(ledgers, new DigestSubmissionStore()),
    );
    const item = {
      title: 'Article',
      summary: 'Summary.',
      selectionReason: 'Relevant.',
    };

    await expect(
      tool.execute(
        {
          items: [
            { ...item, url: 'https://example.com/article?b=2&a=1' },
            { ...item, url: 'https://example.com/article?a=1&b=2#x' },
          ],
        },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'EXECUTION_FAILED' });
  });
});

describe('activate_skill', () => {
  it('loads only an enabled Attached Skill resolved through the current Topic', async () => {
    const getAttachedVersion = vi.fn().mockResolvedValue({
      skill: { id: 'skill-1', name: 'source-guide', currentVersion: 2 },
      version: {
        id: 'version-2',
        skillId: 'skill-1',
        version: 2,
        files: {
          'SKILL.md': '# Source guide',
          'references/sites.md': 'Prefer primary sources.',
        },
        contentHash: 'a'.repeat(64),
        sourceUrl: null,
        createdAt: new Date(),
      },
    });
    const activated = new ActivatedSkillStore();
    const tool = resolve(
      createActivateSkillTool(
        { getAttachedVersion } as unknown as SkillService,
        (runId) => (runId === 'run-1' ? 'topic-1' : 'topic-2'),
        activated,
      ),
    );

    const result = await tool.execute(
      { skillId: 'skill-1' },
      context(),
    );

    expect(getAttachedVersion).toHaveBeenCalledWith('topic-1', 'skill-1');
    expect(result).toMatchObject({
      version: 2,
      path: 'SKILL.md',
      content: '# Source guide',
    });
    expect(activated.snapshot('run-1')).toEqual([
      { skillId: 'skill-1', versionId: 'version-2', version: 2 },
    ]);
  });

  it('rejects paths that escape the standard Skill directories', () => {
    const tool = createActivateSkillTool(
      { getAttachedVersion: vi.fn() } as unknown as SkillService,
      () => 'topic-1',
      new ActivatedSkillStore(),
    );

    expect(
      tool.inputSchema.safeParse({
        skillId: 'skill-1',
        path: 'references/../private.txt',
      }).success,
    ).toBe(false);
  });
});

describe('save_skill', () => {
  it('writes only the current Topic Managed Skill using validated SKILL.md', async () => {
    const saveManagedVersion = vi.fn().mockResolvedValue({
      createdSkill: true,
      skill: { id: 'managed-1' },
      version: {
        id: 'version-1',
        version: 1,
        contentHash: 'b'.repeat(64),
      },
    });
    const packages = new SkillPackageService({
      isAllowed: vi.fn(),
    } as unknown as UrlValidator);
    const tool = resolve(
      createSaveSkillTool(
        packages,
        { saveManagedVersion } as unknown as SkillService,
        () => 'topic-1',
      ),
    );
    const skillMarkdown = `---
name: topic-research
description: Reusable research instructions.
---

# Topic research

Use primary sources and verify publication dates.
`;

    const result = await tool.execute({ skillMarkdown }, context());

    expect(saveManagedVersion).toHaveBeenCalledWith(
      'topic-1',
      expect.objectContaining({
        name: 'topic-research',
        files: { 'SKILL.md': skillMarkdown },
      }),
    );
    expect(result).toMatchObject({
      saved: true,
      skillId: 'managed-1',
      version: 1,
    });
  });
});
