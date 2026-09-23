'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Recording in the browser, for the two places the product needs it: a spoken
 * turn in the simulation, and the ninety-second answer on camera.
 *
 * The candidate hears or sees their own recording before it is sent. Once it
 * is sent, the API transcribes it and deletes the audio — no model ever
 * receives audio or video (`docs/SPEC.md`, section 5).
 */
export const MAX_RECORDING_SECONDS = 60;

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'unsupported';

export interface RecorderOptions {
  /** Camera as well as microphone, for the surprise answer. */
  video?: boolean;
  /** Stops itself here. A simulation turn gets 60 seconds, the surprise answer 90. */
  maxSeconds?: number;
}

export interface Recorder {
  status: RecorderStatus;
  /** Whole seconds recorded so far, so a screen can count down. */
  seconds: number;
  clip: { blob: Blob; url: string } | null;
  /** The live stream, for a camera preview before anything is recorded. */
  stream: MediaStream | null;
  /** Opens the camera and microphone without recording, for a device check. */
  preview: () => void;
  start: () => void;
  stop: () => void;
  discard: () => void;
  release: () => void;
}

function supported(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** webm where it exists, ogg or mp4 elsewhere; the API accepts them all. */
function mimeType(video: boolean): string | undefined {
  const candidates = video ? ['video/webm', 'video/mp4'] : ['audio/webm', 'audio/ogg'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

export function useRecorder({ video = false, maxSeconds = MAX_RECORDING_SECONDS }: RecorderOptions = {}): Recorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const live = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicking = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }, []);

  const release = useCallback(() => {
    live.current?.getTracks().forEach((track) => track.stop());
    live.current = null;
    recorder.current = null;
    setStream(null);
  }, []);

  const open = useCallback(async (): Promise<MediaStream | null> => {
    if (!supported()) {
      setStatus('unsupported');
      return null;
    }
    if (live.current) return live.current;

    setStatus('requesting');
    try {
      const opened = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      live.current = opened;
      setStream(opened);
      setStatus('idle');
      return opened;
    } catch {
      // Refused, or there is no camera or microphone at all.
      setStatus('denied');
      return null;
    }
  }, [video]);

  const preview = useCallback(() => {
    void open();
  }, [open]);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stopTicking();
  }, [stopTicking]);

  const start = useCallback(() => {
    void open().then((opened) => {
      if (!opened) return;

      const type = mimeType(video);
      const media = new MediaRecorder(opened, type ? { mimeType: type } : undefined);
      recorder.current = media;
      chunks.current = [];

      media.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      media.onstop = () => {
        const blob = new Blob(chunks.current, { type: media.mimeType || (video ? 'video/webm' : 'audio/webm') });
        stopTicking();
        setClip({ blob, url: URL.createObjectURL(blob) });
        setStatus(blob.size > 0 ? 'recorded' : 'idle');
      };

      media.start();
      setSeconds(0);
      setStatus('recording');
      ticker.current = setInterval(() => {
        setSeconds((value) => {
          const next = value + 1;
          // The limit is the server's rule too; the screen simply stops first.
          if (next >= maxSeconds) stop();
          return next;
        });
      }, 1000);
    });
  }, [maxSeconds, open, stop, stopTicking, video]);

  const discard = useCallback(() => {
    setClip((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setSeconds(0);
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      stopTicking();
      live.current?.getTracks().forEach((track) => track.stop());
      live.current = null;
    };
  }, [stopTicking]);

  return { status, seconds, clip, stream, preview, start, stop, discard, release };
}
