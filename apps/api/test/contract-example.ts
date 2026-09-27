import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function contractExample<T>(filename: string): T {
  const path = resolve(process.cwd(), '../../docs/contracts/examples/candidate-a', filename);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function contractAudioExample(): Buffer {
  const path = resolve(process.cwd(), '../../fixtures/audio/silence.mp3');
  return readFileSync(path);
}
