import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const execFileAsync = promisify(execFile);

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
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
        this.absolute(audioRef),
      ], { timeout: 10000, maxBuffer: 1024 });
      const duration = Number(stdout.trim());
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid audio duration');
      return duration;
    } catch {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A valid webm or ogg audio file is required.', details: { fields: ['audio'] } });
    }
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
