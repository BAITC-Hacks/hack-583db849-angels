import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * How long a recording is, in seconds, or null when it cannot be read.
 *
 * The container's own header comes first. A browser's MediaRecorder writes
 * webm without a duration in it — `ffprobe` answers `N/A` for every recording
 * made on a screen — so then the file is decoded and its last timestamp read.
 */
export async function audioDurationSeconds(file: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ], { timeout: 20_000, maxBuffer: 1024 });
    const duration = Number(stdout.trim());
    if (Number.isFinite(duration) && duration > 0) return duration;
  } catch {
    // Not readable from the header; decoding below says whether it is audio at all.
  }

  try {
    const { stderr } = await execFileAsync('ffmpeg', ['-nostdin', '-i', file, '-vn', '-f', 'null', '-'], {
      timeout: 120_000, maxBuffer: 32 * 1024 * 1024,
    });
    const last = [...stderr.matchAll(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g)].at(-1);
    if (!last) return null;
    const duration = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
    return duration > 0 ? duration : null;
  } catch {
    return null;
  }
}
