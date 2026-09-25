import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { audioDurationSeconds } from '../../media/audio-duration';
import type { VideoFile } from '../../media/video-range';

const execFileAsync = promisify(execFile);

export const videoTypes = { webm: 'video/webm', mp4: 'video/mp4' } as const;
export type VideoExtension = keyof typeof videoTypes;

/**
 * The container, read from the file's first bytes rather than its declared
 * type: a browser labels a recording `video/webm;codecs=vp8,opus`, and the
 * comma in it is not a valid header value, so the declared type cannot be
 * relied on. mp4 and a phone's mov both start with `ftyp`.
 */
export function videoContainer(video: Buffer | undefined): VideoExtension | null {
  const head = video?.subarray(0, 12);
  if (!head || head.length < 12) return null;
  if (head.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  if (head.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  return null;
}

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

  /** Under `UPLOADS_DIR/<folder>/<id>/`: `surprise` for the surprise answer, `presentations` for the presentation. */
  async saveVideo(id: string, extension: VideoExtension, video: Buffer, folder: 'surprise' | 'presentations' = 'surprise'): Promise<string> {
    const videoRef = join(folder, id, `${randomUUID()}.${extension}`);
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

  /** How long the recording is, or null when it cannot be read as one. */
  durationSeconds(videoRef: string): Promise<number | null> {
    return audioDurationSeconds(this.absolute(videoRef));
  }

  async open(videoRef: string): Promise<VideoFile> {
    const file = this.absolute(videoRef);
    try {
      const { size } = await stat(file);
      const extension = extname(file).slice(1) as VideoExtension;
      return { path: file, type: videoTypes[extension] ?? 'application/octet-stream', size };
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
