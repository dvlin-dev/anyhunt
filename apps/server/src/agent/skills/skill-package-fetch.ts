/**
 * [INPUT]: HTTPS Skill URL, AbortSignal and shared SSRF validator
 * [OUTPUT]: Bounded ZIP bytes or a typed transport failure
 * [POS]: Remote Skill transport boundary; contains no package parsing
 */

import { fetchWithSsrGuard } from '../../common/utils/ssrf-fetch';
import type { UrlValidator } from '../../common/validators/url.validator';
import { SKILL_PACKAGE_LIMITS } from './skill-package.schema';

export class SkillPackageFetchError extends Error {
  constructor(readonly code: 'PACKAGE_LIMIT' | 'REMOTE_FETCH_FAILED') {
    super(
      code === 'PACKAGE_LIMIT'
        ? 'Remote Skill ZIP exceeds the archive size limit'
        : 'Remote Skill package could not be fetched safely',
    );
    this.name = 'SkillPackageFetchError';
  }
}

export async function fetchSkillPackageArchive(
  urlValidator: UrlValidator,
  url: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SkillPackageFetchError('REMOTE_FETCH_FAILED');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new SkillPackageFetchError('REMOTE_FETCH_FAILED');
  }

  try {
    const response = await fetchWithSsrGuard(urlValidator, url, {
      method: 'GET',
      maxRedirects: 3,
      signal,
    });
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`);

    const contentLength = Number(response.headers.get('content-length'));
    if (
      Number.isFinite(contentLength) &&
      contentLength > SKILL_PACKAGE_LIMITS.archiveBytes
    ) {
      throw new SkillPackageFetchError('PACKAGE_LIMIT');
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > SKILL_PACKAGE_LIMITS.archiveBytes) {
      throw new SkillPackageFetchError('PACKAGE_LIMIT');
    }
    return bytes;
  } catch (error) {
    if (error instanceof SkillPackageFetchError) throw error;
    throw new SkillPackageFetchError('REMOTE_FETCH_FAILED');
  }
}
