'use client';

import { ArrowPathIcon, MicrophoneIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useEffect } from 'react';
import { MAX_RECORDING_SECONDS, useRecorder } from '../../lib/simulation/useRecorder';

/**
 * How a candidate takes a turn: press, speak, release.
 *
 * Speaking is the point. A prepared answer cannot be pasted into a microphone,
 * and the way someone thinks out loud under a little pressure is exactly what
 * the interviewer wants to see. The recording is heard back before it is sent,
 * because a microphone mishap is not part of what is assessed.
 */
export function VoiceComposer({
  disabled,
  waiting,
  onSend,
}: {
  disabled: boolean;
  waiting: boolean;
  onSend: (clip: Blob) => boolean;
}) {
  const { status, seconds, clip, start, stop, discard } = useRecorder();
  const busy = disabled || waiting;
  const left = Math.max(0, MAX_RECORDING_SECONDS - seconds);

  // Hold the space bar instead of the button, for anyone not using a mouse.
  useEffect(() => {
    if (busy) return;
    const target = document.body;

    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
      event.preventDefault();
      if (status === 'idle') start();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (status === 'recording') stop();
    };

    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
    };
  }, [busy, start, status, stop]);

  function send() {
    if (clip && onSend(clip.blob)) discard();
  }

  if (status === 'denied' || status === 'unsupported') {
    return (
      <div className="rounded-panel border border-border-subtle bg-bg-surface p-5 text-sm">
        <p className="font-semibold text-text-primary">
          {status === 'denied' ? 'The microphone is not available' : 'This browser cannot record audio'}
        </p>
        <p className="mt-1 text-text-secondary">
          The simulation is spoken. Allow the microphone and reload, or ask the admissions team to switch typing on for
          you — it changes nothing about how the conversation is read.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-4">
      {clip ? (
        <div className="flex flex-col gap-3">
          <audio controls src={clip.url} className="w-full" aria-label="Your recording" />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={discard}
              className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated"
            >
              <ArrowPathIcon aria-hidden="true" className="h-3.5 w-3.5" />
              Record again
            </button>
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send this turn
              <PaperAirplaneIcon aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={busy}
            onPointerDown={(event) => {
              // Keeps the release on this button even if the finger slides off.
              event.currentTarget.setPointerCapture?.(event.pointerId);
              start();
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            aria-pressed={status === 'recording'}
            aria-label={status === 'recording' ? 'Release to finish your turn' : 'Hold to speak'}
            className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              status === 'recording' ? 'bg-brand-ink text-bg-base' : 'bg-brand-green text-on-brand hover:bg-brand-dim'
            }`}
          >
            <MicrophoneIcon aria-hidden="true" className="h-6 w-6" />
          </button>

          <div className="min-w-0 text-sm">
            {status === 'recording' ? (
              <p className="font-semibold text-text-primary" aria-live="polite">
                Listening… <span className="font-mono tabular-nums">{left}s left</span>
              </p>
            ) : (
              <p className="font-semibold text-text-primary">{waiting ? 'Wait for the reply' : 'Hold to speak'}</p>
            )}
            <p className="text-text-secondary">
              {status === 'recording'
                ? 'Release when you have finished. You can listen before sending.'
                : 'Hold the button or the space bar, speak in English, then release. Up to 60 seconds a turn.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
