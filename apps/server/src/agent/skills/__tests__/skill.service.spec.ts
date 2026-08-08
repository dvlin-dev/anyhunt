import { strToU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import type { SkillPackageService } from '../skill-package.service';
import type { SkillRepositoryService } from '../skill-repository.service';
import { SkillService } from '../skill.service';

function createService(overrides: {
  packages?: Partial<SkillPackageService>;
  repository?: Partial<SkillRepositoryService>;
} = {}) {
  return new SkillService(
    overrides.packages as SkillPackageService,
    overrides.repository as SkillRepositoryService,
  );
}

describe('SkillService', () => {
  it('exports the selected immutable version as a standard Skill directory', async () => {
    const repository = {
      getCurrentVersion: vi.fn().mockResolvedValue({
        skill: { id: 'skill-1', name: 'research-sources' },
        version: {
          files: {
            'SKILL.md': '---\nname: research-sources\ndescription: Test\n---\n',
            'references/query.md': 'query',
          },
        },
      }),
    };
    const archive = await createService({ repository }).exportZip(
      'user-1',
      'skill-1',
    );

    expect(unzipSync(archive)).toMatchObject({
      'research-sources/SKILL.md': expect.any(Uint8Array),
      'research-sources/references/query.md': strToU8('query'),
    });
  });

  it('refuses a remote update that changes the standard Skill name', async () => {
    const packages = {
      importFromUrl: vi.fn().mockResolvedValue({
        name: 'different-skill',
        description: 'Different',
        files: {},
        contentHash: 'b'.repeat(64),
      }),
    };
    const repository = {
      getOwned: vi.fn().mockResolvedValue({
        id: 'skill-1',
        name: 'research-sources',
      }),
      addVersion: vi.fn(),
    };

    await expect(
      createService({ packages, repository }).updateFromUrl(
        'user-1',
        'skill-1',
        'https://skills.example.com/research.zip',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.addVersion).not.toHaveBeenCalled();
  });
});
