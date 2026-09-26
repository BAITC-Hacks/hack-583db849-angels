import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** The seeded demo candidates, by externalId. */
const letters: Record<string, 'a' | 'b' | 'c'> = { 'inv-2026-demo-a': 'a', 'inv-2026-demo-b': 'b', 'inv-2026-demo-c': 'c' };

/** A, B and C's externalIds: everything else was sent by the platform (the stand, in the demo). */
export const SEED_EXTERNAL_IDS = Object.keys(letters);

export function seedLetter(externalId: string): 'a' | 'b' | 'c' | null {
  return letters[externalId] ?? null;
}

/** A file from `seed/`, read from the repository root the API runs two levels under. */
export async function readSeed<T>(...path: string[]): Promise<T> {
  return JSON.parse(await readFile(resolve(process.cwd(), '../../seed', ...path), 'utf8')) as T;
}
