import { execFile } from 'node:child_process';

import { audioDurationSeconds } from '../src/media/audio-duration';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

type Callback = (error: Error | null, result?: { stdout: string; stderr: string }) => void;
const run = execFile as unknown as jest.Mock;

/** Answers each call in turn, the way `ffprobe` and then `ffmpeg` would. */
function answers(...results: ({ stdout?: string; stderr?: string } | Error)[]) {
  run.mockReset();
  for (const result of results) {
    run.mockImplementationOnce((_file: string, _args: string[], _options: unknown, callback: Callback) => {
      if (result instanceof Error) callback(result);
      else callback(null, { stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
    });
  }
}

describe('audioDurationSeconds', () => {
  it('takes the length from the header when the file has one', async () => {
    answers({ stdout: '12.5\n' });
    await expect(audioDurationSeconds('/uploads/a.wav')).resolves.toBe(12.5);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('decodes a browser recording, whose header says N/A, and reads its last timestamp', async () => {
    answers({ stdout: 'N/A\n' }, { stderr: 'size=N/A time=00:00:01.02 bitrate=N/A\nsize=N/A time=00:01:03.18 bitrate=N/A\n' });
    await expect(audioDurationSeconds('/uploads/turn.webm')).resolves.toBeCloseTo(63.18);
    expect(run.mock.calls[1][0]).toBe('ffmpeg');
  });

  it('answers null for a file that is not audio at all', async () => {
    answers(new Error('Invalid data found when processing input'), new Error('Invalid data found when processing input'));
    await expect(audioDurationSeconds('/uploads/text.webm')).resolves.toBeNull();
  });
});
