'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The call's sound, both voices in one track, recorded on the interviewer's
 * screen with the candidate's consent. The camera pictures are never part of
 * it: only audio goes to the recording, and from there to transcription.
 */
export interface CallRecording {
  recording: boolean;
  seconds: number;
  /** Starts with these voices; false when the browser cannot record. */
  start: (tracks: MediaStreamTrack[]) => boolean;
  /** A voice that arrived after the start, such as the candidate reconnecting. */
  add: (track: MediaStreamTrack) => void;
  /** Ends the recording and hands it over; null if nothing was recorded. */
  stop: () => Promise<Blob | null>;
  /** Ends it and throws it away — when the candidate withdraws consent. */
  discard: () => void;
}

function audioType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported?.(type));
}

export function useCallRecording(): CallRecording {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const context = useRef<AudioContext | null>(null);
  const mix = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mixed = useRef(new Set<string>());

  const close = useCallback(() => {
    void context.current?.close();
    context.current = null;
    mix.current = null;
    recorder.current = null;
    mixed.current.clear();
    setRecording(false);
  }, []);

  useEffect(() => () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    void context.current?.close();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [recording]);

  const add = useCallback((track: MediaStreamTrack) => {
    if (!context.current || !mix.current || mixed.current.has(track.id)) return;
    mixed.current.add(track.id);
    context.current.createMediaStreamSource(new MediaStream([track])).connect(mix.current);
  }, []);

  const start = useCallback(
    (tracks: MediaStreamTrack[]) => {
      if (typeof MediaRecorder === 'undefined' || typeof AudioContext === 'undefined') return false;
      context.current = new AudioContext();
      mix.current = context.current.createMediaStreamDestination();
      tracks.forEach(add);
      const type = audioType();
      recorder.current = new MediaRecorder(mix.current.stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      recorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.current.start(1000);
      setSeconds(0);
      setRecording(true);
      return true;
    },
    [add],
  );

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const media = recorder.current;
        if (!media || media.state !== 'recording') {
          close();
          resolve(null);
          return;
        }
        media.onstop = () => {
          const blob = new Blob(chunks.current, { type: media.mimeType || 'audio/webm' });
          close();
          resolve(blob.size > 0 ? blob : null);
        };
        media.stop();
      }),
    [close],
  );

  const discard = useCallback(() => {
    const media = recorder.current;
    if (media) media.onstop = null;
    if (media?.state === 'recording') media.stop();
    chunks.current = [];
    close();
  }, [close]);

  return { recording, seconds, start, add, stop, discard };
}
