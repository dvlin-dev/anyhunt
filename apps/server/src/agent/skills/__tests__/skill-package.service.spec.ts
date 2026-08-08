import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UrlValidator } from '../../../common/validators/url.validator';
import {
  SkillPackageError,
  SkillPackageService,
} from '../skill-package.service';

const MINIMAL_SKILL = `---
name: research-sources
description: Finds reliable sources for a research topic.
---

# Research sources

Verify claims with primary sources.
`;

function archive(
  files: Record<string, Uint8Array | string>,
): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        typeof content === 'string' ? strToU8(content) : content,
      ]),
    ),
  );
}

function markFirstEntryAsSymlink(input: Uint8Array): Uint8Array {
  const result = input.slice();
  const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

  for (let offset = 0; offset <= result.length - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    result[offset + 5] = 3;
    view.setUint32(offset + 38, 0xa1ff0000, true);
    return result;
  }

  throw new Error('ZIP central directory was not found');
}

function createService(isAllowed = vi.fn().mockResolvedValue(true)) {
  return new SkillPackageService({ isAllowed } as unknown as UrlValidator);
}

describe('SkillPackageService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts the minimal standard Agent Skill package', () => {
    const parsed = createService().parseZip(
      archive({
        'research-sources/SKILL.md': MINIMAL_SKILL,
        'research-sources/references/query.md': 'Use exact product names.',
      }),
    );

    expect(parsed).toMatchObject({
      name: 'research-sources',
      description: 'Finds reliable sources for a research topic.',
      files: {
        'SKILL.md': MINIMAL_SKILL,
        'references/query.md': 'Use exact product names.',
      },
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it.each([
    [
      'missing Frontmatter',
      '# No frontmatter',
      'INVALID_FRONTMATTER',
    ],
    [
      'invalid name',
      MINIMAL_SKILL.replace('research-sources', 'Research Sources'),
      'INVALID_NAME',
    ],
  ])('rejects %s', (_label, skillFile, code) => {
    expect(() =>
      createService().parseZip(
        archive({ 'research-sources/SKILL.md': skillFile }),
      ),
    ).toThrowError(expect.objectContaining({ code }));
  });

  it('rejects path traversal, scripts, excessive depth, and too many files', () => {
    const cases: Array<[Uint8Array, SkillPackageError['code']]> = [
      [
        archive({
          'research-sources/SKILL.md': MINIMAL_SKILL,
          '../escape.txt': 'escape',
        }),
        'UNSAFE_PATH',
      ],
      [
        archive({
          'research-sources/SKILL.md': MINIMAL_SKILL,
          'research-sources/scripts/run.sh': 'exit 0',
        }),
        'UNSUPPORTED_ENTRY',
      ],
      [
        archive({
          'research-sources/SKILL.md': MINIMAL_SKILL,
          'research-sources/references/a/b/c/file.md': 'too deep',
        }),
        'PACKAGE_LIMIT',
      ],
      [
        archive({
          'research-sources/SKILL.md': MINIMAL_SKILL,
          ...Object.fromEntries(
            Array.from({ length: 64 }, (_, index) => [
              `research-sources/references/${index}.md`,
              String(index),
            ]),
          ),
        }),
        'PACKAGE_LIMIT',
      ],
    ];

    for (const [input, code] of cases) {
      expect(() => createService().parseZip(input)).toThrowError(
        expect.objectContaining({ code }),
      );
    }
  });

  it('rejects symlinks and binary content', () => {
    const symlink = markFirstEntryAsSymlink(
      archive({
        'research-sources/SKILL.md': MINIMAL_SKILL,
      }),
    );
    expect(() => createService().parseZip(symlink)).toThrowError(
      expect.objectContaining({ code: 'UNSAFE_ENTRY' }),
    );

    expect(() =>
      createService().parseZip(
        archive({
          'research-sources/SKILL.md': MINIMAL_SKILL,
          'research-sources/assets/data.bin': new Uint8Array([0, 159, 255]),
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'BINARY_CONTENT' }));
  });

  it('rejects oversized and suspiciously compressed archives', () => {
    expect(() =>
      createService().parseZip(
        archive({
          'research-sources/SKILL.md': MINIMAL_SKILL,
          'research-sources/references/large.md': 'x'.repeat(120_000),
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'ZIP_BOMB' }));

    const pseudoRandom = Array.from(
      { length: 270_000 },
      (_, index) => String.fromCharCode(33 + ((index * 31) % 90)),
    ).join('');
    expect(() =>
      createService().parseZip(
        archive({
          'research-sources/SKILL.md': MINIMAL_SKILL,
          'research-sources/references/oversized.md': pseudoRandom,
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'PACKAGE_LIMIT' }));
  });

  it('revalidates every HTTPS redirect and rejects a private redirect target', async () => {
    const isAllowed = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private.zip' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(
      createService(isAllowed).importFromUrl(
        'https://skills.example.com/research.zip',
      ),
    ).rejects.toMatchObject({ code: 'REMOTE_FETCH_FAILED' });
    expect(isAllowed).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
