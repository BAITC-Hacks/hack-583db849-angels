import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { audioDurationSeconds } from '../../media/audio-duration';

@Injectable()
export class AudioStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('UPLOADS_DIR', '/data/uploads'));
  }

  async saveCandidate(simulationId: string, extension: 'webm' | 'ogg', audio: Buffer): Promise<string> {
    return this.save(join('turns', simulationId, `${randomUUID()}.${extension}`), audio);
  }

  async saveCharacter(simulationId: string, audio: Buffer): Promise<string> {
    return this.save(join('character', simulationId, `${randomUUID()}.mp3`), audio);
  }

  async durationSeconds(audioRef: string): Promise<number> {
    const duration = await audioDurationSeconds(this.absolute(audioRef));
    if (duration === null) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A valid webm or ogg audio file is required.', details: { fields: ['audio'] } });
    }
    return duration;
  }

  async read(audioRef: string): Promise<Buffer> {
    try { return await readFile(this.absolute(audioRef)); }
    catch { throw new NotFoundException({ code: 'NOT_FOUND', message: 'Character audio was not found.' }); }
  }

  async delete(audioRef: string): Promise<void> {
    try { await unlink(this.absolute(audioRef)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private async save(audioRef: string, audio: Buffer): Promise<string> {
    const file = this.absolute(audioRef);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, audio, { flag: 'wx' });
    return audioRef;
  }

  private absolute(audioRef: string): string {
    const file = resolve(this.root, audioRef);
    if (!file.startsWith(`${this.root}/`)) throw new Error('Invalid audio reference');
    return file;
  }
}
