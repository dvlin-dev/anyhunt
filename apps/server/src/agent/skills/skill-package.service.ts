/**
 * [INPUT]: ZIP bytes or an HTTPS Agent Skill package URL
 * [OUTPUT]: Validated, normalized, text-only Agent Skill package
 * [POS]: Security boundary for all imported Skill content
 */

import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { unzipSync } from 'fflate';
import { parseDocument } from 'yaml';
import { UrlValidator } from '../../common/validators/url.validator';
import {
  fetchSkillPackageArchive,
  SkillPackageFetchError,
} from './skill-package-fetch';
import {
  SKILL_PACKAGE_LIMITS,
  SkillFrontmatterSchema,
  type ParsedSkillPackage,
} from './skill-package.schema';

export type SkillPackageErrorCode =
  | 'INVALID_ARCHIVE'
  | 'UNSAFE_PATH'
  | 'UNSAFE_ENTRY'
  | 'UNSUPPORTED_ENTRY'
  | 'BINARY_CONTENT'
  | 'ZIP_BOMB'
  | 'PACKAGE_LIMIT'
  | 'MISSING_SKILL_FILE'
  | 'INVALID_FRONTMATTER'
  | 'INVALID_NAME'
  | 'REMOTE_FETCH_FAILED';

export class SkillPackageError extends Error {
  constructor(
    readonly code: SkillPackageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SkillPackageError';
  }
}

interface ZipEntryMetadata {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  externalAttributes: number;
  encrypted: boolean;
}

const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const UNIX_FILE_TYPE_MASK = 0xf000;
const UNIX_SYMLINK_TYPE = 0xa000;
const textDecoder = new TextDecoder('utf-8', { fatal: true });

function readZipMetadata(archive: Uint8Array): ZipEntryMetadata[] {
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );
  const entries: ZipEntryMetadata[] = [];
  let endOffset = -1;
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) {
    throw new SkillPackageError(
      'INVALID_ARCHIVE',
      'ZIP end-of-directory record is missing',
    );
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  let offset = view.getUint32(endOffset + 16, true);
  const centralDirectoryEnd = offset + centralDirectorySize;
  if (centralDirectoryEnd > endOffset || entryCount === 0) {
    throw new SkillPackageError(
      'INVALID_ARCHIVE',
      'ZIP central directory is invalid',
    );
  }

  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset > archive.length - 46 ||
      view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      throw new SkillPackageError(
        'INVALID_ARCHIVE',
        'ZIP central directory is invalid',
      );
    }

    const flags = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryEnd = offset + 46 + fileNameLength + extraLength + commentLength;
    if (entryEnd > archive.length) {
      throw new SkillPackageError(
        'INVALID_ARCHIVE',
        'ZIP central directory is truncated',
      );
    }

    let path: string;
    try {
      path = textDecoder.decode(
        archive.subarray(offset + 46, offset + 46 + fileNameLength),
      );
    } catch {
      throw new SkillPackageError(
        'INVALID_ARCHIVE',
        'ZIP entry name is not valid UTF-8',
      );
    }

    entries.push({
      path,
      compressedSize,
      uncompressedSize,
      externalAttributes: view.getUint32(offset + 38, true),
      encrypted: (flags & 0x1) !== 0,
    });
    offset = entryEnd;
  }

  if (entries.length !== entryCount || offset !== centralDirectoryEnd) {
    throw new SkillPackageError(
      'INVALID_ARCHIVE',
      'ZIP central directory entry count is invalid',
    );
  }

  return entries;
}

function isSymlink(entry: ZipEntryMetadata): boolean {
  const unixMode = entry.externalAttributes >>> 16;
  return (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK_TYPE;
}

function assertSafeRawPath(path: string): void {
  if (
    path.length === 0 ||
    path.includes('\0') ||
    path.includes('\\') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path)
  ) {
    throw new SkillPackageError('UNSAFE_PATH', 'ZIP contains an unsafe path');
  }

  const segments = path.split('/').filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new SkillPackageError('UNSAFE_PATH', 'ZIP contains an unsafe path');
  }
}

function commonRoot(paths: string[]): string | null {
  if (paths.some((path) => path === 'SKILL.md')) return null;
  const firstSegments = new Set(paths.map((path) => path.split('/')[0]));
  return firstSegments.size === 1 ? paths[0].split('/')[0] : null;
}

function normalizePath(path: string, root: string | null): string {
  const withoutRoot = root ? path.slice(root.length + 1) : path;
  const normalized = withoutRoot.replace(/\/$/, '');

  if (!normalized) {
    throw new SkillPackageError(
      'UNSUPPORTED_ENTRY',
      'Empty directory entries are not Skill files',
    );
  }

  const segments = normalized.split('/');
  if (segments.length > SKILL_PACKAGE_LIMITS.pathDepth) {
    throw new SkillPackageError(
      'PACKAGE_LIMIT',
      'Skill package exceeds the maximum path depth',
    );
  }

  const allowed =
    normalized === 'SKILL.md' ||
    normalized.startsWith('references/') ||
    normalized.startsWith('assets/');
  if (!allowed || normalized.startsWith('scripts/')) {
    throw new SkillPackageError(
      'UNSUPPORTED_ENTRY',
      'Skill package contains an unsupported entry',
    );
  }

  return normalized;
}

function decodeText(content: Uint8Array): string {
  let decoded: string;
  try {
    decoded = textDecoder.decode(content);
  } catch {
    throw new SkillPackageError(
      'BINARY_CONTENT',
      'Skill package files must be UTF-8 text',
    );
  }

  if (decoded.includes('\0')) {
    throw new SkillPackageError(
      'BINARY_CONTENT',
      'Skill package files must be UTF-8 text',
    );
  }

  return decoded;
}

function parseFrontmatter(skillMarkdown: string) {
  const match = skillMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match || match[1].length > 16_384) {
    throw new SkillPackageError(
      'INVALID_FRONTMATTER',
      'SKILL.md must contain bounded YAML Frontmatter',
    );
  }

  const document = parseDocument(match[1], {
    schema: 'core',
  });
  if (document.errors.length > 0) {
    throw new SkillPackageError(
      'INVALID_FRONTMATTER',
      'SKILL.md Frontmatter is invalid',
    );
  }

  let data: unknown;
  try {
    data = document.toJS({ maxAliasCount: 0 });
  } catch {
    throw new SkillPackageError(
      'INVALID_FRONTMATTER',
      'SKILL.md Frontmatter is unsafe',
    );
  }

  const parsed = SkillFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const invalidName =
      data !== null &&
      typeof data === 'object' &&
      Object.prototype.hasOwnProperty.call(data, 'name');
    throw new SkillPackageError(
      invalidName ? 'INVALID_NAME' : 'INVALID_FRONTMATTER',
      'SKILL.md Frontmatter does not meet the Agent Skills specification',
    );
  }

  return parsed.data;
}

function hashFiles(files: Record<string, string>): string {
  const hash = createHash('sha256');
  for (const path of Object.keys(files).sort()) {
    hash.update(String(Buffer.byteLength(path)));
    hash.update(':');
    hash.update(path);
    hash.update(String(Buffer.byteLength(files[path])));
    hash.update(':');
    hash.update(files[path]);
  }
  return hash.digest('hex');
}

@Injectable()
export class SkillPackageService {
  constructor(private readonly urlValidator: UrlValidator) {}

  parseGeneratedSkill(skillMarkdown: string): ParsedSkillPackage {
    return this.finalizeFiles({ 'SKILL.md': skillMarkdown }, null);
  }

  parseZip(archive: Uint8Array): ParsedSkillPackage {
    if (archive.byteLength > SKILL_PACKAGE_LIMITS.archiveBytes) {
      throw new SkillPackageError(
        'PACKAGE_LIMIT',
        'Skill ZIP exceeds the archive size limit',
      );
    }

    const metadata = readZipMetadata(archive);
    const fileEntries = metadata.filter((entry) => !entry.path.endsWith('/'));
    if (fileEntries.length > SKILL_PACKAGE_LIMITS.files) {
      throw new SkillPackageError(
        'PACKAGE_LIMIT',
        'Skill package has too many files',
      );
    }

    for (const entry of metadata) {
      assertSafeRawPath(entry.path);
      if (entry.encrypted || isSymlink(entry)) {
        throw new SkillPackageError(
          'UNSAFE_ENTRY',
          'Encrypted files and symbolic links are not allowed',
        );
      }
    }

    let totalUncompressed = 0;
    for (const entry of fileEntries) {
      totalUncompressed += entry.uncompressedSize;
      if (totalUncompressed > SKILL_PACKAGE_LIMITS.uncompressedBytes) {
        throw new SkillPackageError(
          'PACKAGE_LIMIT',
          'Skill package exceeds the uncompressed size limit',
        );
      }

      if (
        entry.uncompressedSize > 4_096 &&
        entry.uncompressedSize / Math.max(1, entry.compressedSize) >
          SKILL_PACKAGE_LIMITS.compressionRatio
      ) {
        throw new SkillPackageError(
          'ZIP_BOMB',
          'Skill ZIP has a suspicious compression ratio',
        );
      }
    }

    let extracted: Record<string, Uint8Array>;
    try {
      extracted = unzipSync(archive);
    } catch (error) {
      if (error instanceof SkillPackageError) throw error;
      throw new SkillPackageError('INVALID_ARCHIVE', 'Skill ZIP is invalid');
    }

    const rawPaths = fileEntries.map((entry) => entry.path);
    const root = commonRoot(rawPaths);
    const files: Record<string, string> = {};
    const normalizedPaths = new Set<string>();

    for (const entry of fileEntries) {
      const path = normalizePath(entry.path, root);
      const comparisonPath = path.toLocaleLowerCase('en-US');
      if (normalizedPaths.has(comparisonPath)) {
        throw new SkillPackageError(
          'UNSAFE_PATH',
          'Skill ZIP contains duplicate normalized paths',
        );
      }
      normalizedPaths.add(comparisonPath);

      const content = extracted[entry.path];
      if (!content) {
        throw new SkillPackageError(
          'INVALID_ARCHIVE',
          'Skill ZIP entry could not be extracted',
        );
      }
      files[path] = decodeText(content);
    }

    return this.finalizeFiles(files, root);
  }

  private finalizeFiles(
    files: Record<string, string>,
    root: string | null,
  ): ParsedSkillPackage {
    const skillMarkdown = files['SKILL.md'];
    if (!skillMarkdown) {
      throw new SkillPackageError(
        'MISSING_SKILL_FILE',
        'Skill package must contain SKILL.md',
      );
    }
    if (
      skillMarkdown.split(/\r?\n/).length >
        SKILL_PACKAGE_LIMITS.skillMarkdownLines ||
      skillMarkdown.length > SKILL_PACKAGE_LIMITS.skillMarkdownCharacters
    ) {
      throw new SkillPackageError(
        'PACKAGE_LIMIT',
        'SKILL.md exceeds the line limit',
      );
    }

    const frontmatter = parseFrontmatter(skillMarkdown);
    if (root && root !== frontmatter.name) {
      throw new SkillPackageError(
        'INVALID_NAME',
        'Skill directory name must match Frontmatter name',
      );
    }

    const sortedFiles = Object.fromEntries(
      Object.entries(files).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      files: sortedFiles,
      contentHash: hashFiles(sortedFiles),
    };
  }

  async importFromUrl(
    url: string,
    signal?: AbortSignal,
  ): Promise<ParsedSkillPackage> {
    try {
      const bytes = await fetchSkillPackageArchive(
        this.urlValidator,
        url,
        signal,
      );
      return this.parseZip(bytes);
    } catch (error) {
      if (error instanceof SkillPackageError) throw error;
      if (error instanceof SkillPackageFetchError) {
        throw new SkillPackageError(error.code, error.message);
      }
      throw new SkillPackageError(
        'REMOTE_FETCH_FAILED',
        'Remote Skill package could not be fetched safely',
      );
    }
  }
}
