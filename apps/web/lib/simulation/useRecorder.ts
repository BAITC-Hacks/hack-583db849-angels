'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One spoken turn, recorded in the browser: press, speak, release.
 *
 * The candidate hears their own recording before it is sent and can record it
 * again — the only place in the product where they get a second try, because a
 * microphone mishap is not part of what is being assessed. The recording goes
 * to the API, is transcribed, and the audio is deleted; no model ever receives
 * audio (`docs/SPEC.md`, section 5).
 */
export const MAX_RECORDING_SECONDS = 60;

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'unsupported';

export interface Recorder {
  status: RecorderStatus;
  /** Whole seconds recorded so far, so the screen can count down from sixty. */
  seconds: number;
  clip: { blob: Blob; url: string } | null;
  start: () => void;
  stop: () => void;
  discard: () => void;
}

function supported(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** webm where it exists, ogg on Firefox; the API accepts both. */
function mimeType(): string | undefined {
  for (const type of ['audio/webm', 'audio/ogg']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

export function useRecorder(): Recorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicking = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }, []);

  const releaseMicrophone = useCallback(() => {
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stopTicking();
  }, [stopTicking]);

  const start = useCallback(() => {
    if (!supported()) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const type = mimeType();
        const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        recorder.current = media;
        chunks.current = [];

        media.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) chunks.current.push(event.data);
        };
        media.onstop = () => {
          const blob = new Blob(chunks.current, { type: media.mimeType || 'audio/webm' });
          releaseMicrophone();
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
            // A turn is a turn, not a monologue: sixty seconds and it stops itself.
            if (next >= MAX_RECORDING_SECONDS) stop();
            return next;
          });
        }, 1000);
      })
      .catch(() => {
        // Refused, or there is no microphone at all. Staff can switch typing on.
        setStatus('denied');
      });
  }, [releaseMicrophone, stop, stopTicking]);

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
      releaseMicrophone();
    };
  }, [releaseMicrophone, stopTicking]);

  return { status, seconds, clip, start, stop, discard };
}
