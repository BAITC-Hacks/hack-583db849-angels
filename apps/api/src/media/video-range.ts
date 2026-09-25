import { createReadStream } from 'node:fs';

import { HttpException, HttpStatus, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';

/** A stored video: where it is on disk, what it is and how big. Nothing is opened until it is sent. */
export interface VideoFile {
  path: string;
  type: string;
  size: number;
}

/**
 * The one `bytes=` range in a `Range` header, against a file of `size` bytes:
 * `a-b`, `a-`, or the last `-n` bytes. `undefined` means the whole file — no
 * header, several ranges, or a form this does not read. `null` means the
 * range lies outside the file.
 */
export function byteRange(header: string | undefined, size: number): { start: number; end: number } | null | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match || (match[1] === '' && match[2] === '')) return undefined;
  if (match[1] === '') {
    const last = Number(match[2]);
    return last === 0 || size === 0 ? null : { start: Math.max(0, size - last), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start >= size || end < start ? null : { start, end };
}

/**
 * Whether this request is someone starting to watch, for the audit log. A
 * player asks for several ranges while one person watches: only the one from
 * the first byte counts, and Safari's two-byte probe before it does not.
 */
export function countsAsView(header: string | undefined, size: number): boolean {
  const range = byteRange(header, size);
  return range === undefined || (range !== null && range.start === 0 && range.end > 1);
}

/**
 * Streams the video, or with `206` the part the player asked for. Safari
 * plays nothing that is served without ranges, and no browser can seek in it.
 */
export function sendVideo(response: Response, file: VideoFile, header: string | undefined): StreamableFile {
  response.setHeader('Accept-Ranges', 'bytes');
  const range = byteRange(header, file.size);
  if (range === null) {
    response.setHeader('Content-Range', `bytes */${file.size}`);
    throw new HttpException({ code: 'RANGE_NOT_SATISFIABLE', message: 'The requested range is outside the video.' }, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
  }
  if (range === undefined) return new StreamableFile(createReadStream(file.path), { type: file.type, length: file.size });
  response.status(HttpStatus.PARTIAL_CONTENT);
  response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
  return new StreamableFile(createReadStream(file.path, range), { type: file.type, length: range.end - range.start + 1 });
}
