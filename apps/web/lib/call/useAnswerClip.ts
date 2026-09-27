'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Records only the candidate's subscribed microphone track, never the local mic or the call mix. */
export function useAnswerClip() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const complete = useRef<((result: { audio: Blob | null; seconds: number }) => void) | null>(null);
  const [clip, setClip] = useState<{ audio: Blob | null; seconds: number } | null>(null);

  const discard = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const current = recorder.current;
    recorder.current = null;
    if (current?.state === 'recording') current.stop();
    complete.current?.({ audio: null, seconds: 0 });
    complete.current = null;
    chunks.current = [];
    setRecording(false);
    setClip(null);
    setSeconds(0);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
    mounted.current = false;
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
    complete.current?.({ audio: null, seconds: 0 });
    complete.current = null;
    };
  }, []);

  const stop = useCallback(() => new Promise<{ audio: Blob | null; seconds: number }>((resolve) => {
    const current = recorder.current;
    if (!current || current.state !== 'recording') {
      resolve({ audio: null, seconds: 0 });
      return;
    }
    complete.current = resolve;
    current.stop();
  }), []);

  const start = useCallback((track: MediaStreamTrack | null) => {
    if (recorder.current || !track || track.kind !== 'audio' || typeof MediaRecorder === 'undefined') return false;
    try {
      const type = ['audio/webm', 'audio/ogg'].find((mime) => MediaRecorder.isTypeSupported?.(mime));
      const current = new MediaRecorder(new MediaStream([track]), type ? { mimeType: type } : undefined);
      chunks.current = [];
      current.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      current.onstop = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        if (recorder.current !== current) return;
        recorder.current = null;
        const duration = Math.min(120, (Date.now() - started.current) / 1000);
        const audio = new Blob(chunks.current, { type: current.mimeType || 'audio/webm' });
        const result = { audio: audio.size ? audio : null, seconds: duration };
        if (mounted.current) {
          setClip(result);
          setSeconds(Math.floor(duration));
          setRecording(false);
        }
        complete.current?.(result);
        complete.current = null;
      };
      current.start(1000);
      recorder.current = current;
      started.current = Date.now();
      setClip(null);
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const elapsed = Date.now() - started.current;
        setSeconds(Math.min(120, Math.floor(elapsed / 1000)));
        if (elapsed >= 120_000 && current.state === 'recording') current.stop();
      }, 250);
      return true;
    } catch {
      recorder.current = null;
      return false;
    }
  }, []);

  return { recording, seconds, clip, start, stop, discard };
}
