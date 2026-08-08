import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const SERVER_SRC = resolve(REPO_ROOT, 'apps/server/src');

function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name)))
    .map((entry) => resolve(entry.parentPath, entry.name))
    .filter((file) => !file.includes('/__tests__/') && !file.endsWith('.spec.ts'));
}

function importSources(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map(
    (match) => match[1]!,
  );
}

function resolvedImports(file: string): string[] {
  return importSources(file)
    .filter((source) => source.startsWith('.'))
    .map((source) => resolve(dirname(file), source));
}

describe('module boundaries', () => {
  it('keeps runtime contracts independent from NestJS, Prisma and product domains', () => {
    const contracts = sourceFiles(resolve(SERVER_SRC, 'agent/contracts'));
    for (const file of contracts) {
      const imports = importSources(file);
      expect(imports, file).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^@nestjs\//),
          expect.stringMatching(/prisma/i),
          expect.stringMatching(/(?:topic|subscription|delivery)/),
        ]),
      );
    }
  });

  it('keeps acquisition modules independent from product domains', () => {
    for (const moduleName of ['search', 'map', 'scraper', 'browser']) {
      for (const file of sourceFiles(resolve(SERVER_SRC, moduleName))) {
        for (const imported of resolvedImports(file)) {
          expect(imported, file).not.toMatch(/\/src\/(?:topic|subscription|inbox|delivery|agent)(?:\/|$)/);
        }
      }
    }
  });

  it('keeps Subscription independent from the Agent runtime', () => {
    for (const file of sourceFiles(resolve(SERVER_SRC, 'subscription'))) {
      for (const imported of resolvedImports(file)) {
        expect(imported, file).not.toMatch(/\/src\/agent(?:\/|$)/);
      }
    }
  });

  it('keeps Web and Admin independent from Server source code', () => {
    for (const app of ['web', 'admin']) {
      for (const file of sourceFiles(resolve(REPO_ROOT, `apps/${app}/src`))) {
        const imports = importSources(file);
        expect(imports, file).not.toEqual(
          expect.arrayContaining([
            '@anyhunt/server',
            expect.stringMatching(/apps\/server|server\/src/),
          ]),
        );
        for (const imported of resolvedImports(file)) {
          expect(imported, file).not.toMatch(/\/apps\/server(?:\/|$)/);
        }
      }
    }
  });
});
