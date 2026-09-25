import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const execFileAsync = promisify(execFile);

export type AudioExtension = 'webm' | 'ogg' | 'wav';

/**
 * An interview recording on disk, under `UPLOADS_DIR/interviews/<id>/`, for
 * exactly as long as it takes to transcribe it. Only the text is kept.
 */
@Injectable()
export class InterviewAudioService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('UPLOADS_DIR', '/data/uploads'));
  }

  /**
   * The container, from the file's first bytes rather than its declared type,
   * which a browser writes with codec parameters an upload parser can drop.
   */
  extension(audio: Buffer): AudioExtension | null {
    if (audio.length < 12) return null;
    if (audio.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
    if (audio.toString('latin1', 0, 4) === 'OggS') return 'ogg';
    if (audio.toString('latin1', 0, 4) === 'RIFF' && audio.toString('latin1', 8, 12) === 'WAVE') return 'wav';
    return null;
  }

  async save(interviewId: string, extension: AudioExtension, audio: Buffer): Promise<string> {
    const audioRef = join('interviews', interviewId, `${randomUUID()}.${extension}`);
    const file = this.absolute(audioRef);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, audio, { flag: 'wx' });
    return audioRef;
  }

  async durationSeconds(audioRef: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', this.absolute(audioRef),
      ], { timeout: 20_000, maxBuffer: 1024 });
      const duration = Number(stdout.trim());
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid audio duration');
      return duration;
    } catch {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A readable webm, ogg or wav recording is required.', details: { fields: ['audio'] } });
    }
  }

  async delete(audioRef: string): Promise<void> {
    try { await unlink(this.absolute(audioRef)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private absolute(audioRef: string): string {
    const file = resolve(this.root, audioRef);
    if (!file.startsWith(`${this.root}/`)) throw new Error('Invalid audio reference');
    return file;
  }
}
