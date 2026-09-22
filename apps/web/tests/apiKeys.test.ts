import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { apiBaseUrl, apiKeyFor } from '../lib/api/serverKeys';
import { readDemoRole } from '../lib/roles';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('the key for a role', () => {
  it('gives each role its own key, and the candidate the platform key', () => {
    process.env.WEB_API_KEY_PLATFORM = 'p';
    process.env.WEB_API_KEY_INTERVIEWER = 'i';
    process.env.WEB_API_KEY_COMMISSION = 'c';
    process.env.WEB_API_KEY_ADMIN = 'a';

    expect(apiKeyFor('candidate')).toBe('p');
    expect(apiKeyFor('interviewer')).toBe('i');
    expect(apiKeyFor('commission')).toBe('c');
    expect(apiKeyFor('admin')).toBe('a');
  });

  it('falls back to the interviewer for an unknown cookie value', () => {
    expect(readDemoRole('president')).toBe('interviewer');
    expect(readDemoRole(undefined)).toBe('interviewer');
    expect(readDemoRole('commission')).toBe('commission');
  });

  it('reads the API address from the environment, without a trailing slash', () => {
    process.env.API_INTERNAL_URL = 'http://api:3001/';
    expect(apiBaseUrl()).toBe('http://api:3001');
  });
});

/** Walks the app's source, ignoring build output and this test folder. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) return [];
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe('the keys stay on the server', () => {
  it('is imported only by the route handler that adds the key', () => {
    const importers = ['app', 'components', 'lib', 'mocks']
      .flatMap((dir) => sourceFiles(join(process.cwd(), dir)))
      .filter((file) => /from '.*api\/serverKeys'/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(`${process.cwd()}/`, ''));

    expect(importers).toEqual(['app/api/v1/[...path]/route.ts']);
  });

  it('never names a key variable in code a browser downloads', () => {
    const leaks = ['components', 'lib']
      .flatMap((dir) => sourceFiles(join(process.cwd(), dir)))
      .filter((file) => !file.endsWith('lib/api/serverKeys.ts'))
      .filter((file) => readFileSync(file, 'utf8').includes('WEB_API_KEY_'));

    expect(leaks).toEqual([]);
  });
});
