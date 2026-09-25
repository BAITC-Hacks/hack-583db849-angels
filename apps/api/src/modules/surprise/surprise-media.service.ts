import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const execFileAsync = promisify(execFile);

export const videoTypes = { webm: 'video/webm', mp4: 'video/mp4' } as const;
export type VideoExtension = keyof typeof videoTypes;

/**
 * The surprise answer on disk, under `UPLOADS_DIR/surprise/<id>/`. The video
 * stays for staff playback; the audio track is cut out of it with `ffmpeg`
 * only to be transcribed, and deleted straight after.
 */
@Injectable()
export class SurpriseMediaService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('UPLOADS_DIR', '/data/uploads'));
  }

  async saveVideo(surpriseId: string, extension: VideoExtension, video: Buffer): Promise<string> {
    const videoRef = join('surprise', surpriseId, `${randomUUID()}.${extension}`);
    const file = this.absolute(videoRef);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, video, { flag: 'wx' });
    return videoRef;
  }

  /** Mono 16 kHz WAV next to the video: the one thing the transcriber gets. */
  async extractAudio(videoRef: string): Promise<string> {
    const audioRef = join(dirname(videoRef), `${randomUUID()}.wav`);
    await execFileAsync('ffmpeg', [
      '-v', 'error', '-i', this.absolute(videoRef), '-vn', '-ac', '1', '-ar', '16000', '-y', this.absolute(audioRef),
    ], { timeout: 60_000, maxBuffer: 64 * 1024 });
    return audioRef;
  }

  async open(videoRef: string): Promise<{ stream: ReadStream; type: string; length: number }> {
    const file = this.absolute(videoRef);
    try {
      const { size } = await stat(file);
      const extension = extname(file).slice(1) as VideoExtension;
      return { stream: createReadStream(file), type: videoTypes[extension] ?? 'application/octet-stream', length: size };
    } catch {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'The video was not found.' });
    }
  }

  async delete(ref: string): Promise<void> {
    try { await unlink(this.absolute(ref)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private absolute(ref: string): string {
    const file = resolve(this.root, ref);
    if (!file.startsWith(`${this.root}/`)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'The file was not found.' });
    return file;
  }
}
