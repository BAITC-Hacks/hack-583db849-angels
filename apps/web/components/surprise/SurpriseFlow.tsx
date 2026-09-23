'use client';

import { CheckCircleIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRecorder } from '../../lib/media/useRecorder';
import type { SurpriseQuestion } from '../../lib/surprise/types';

/** Ten seconds between reading the question and the camera starting. */
const READING_SECONDS = 10;

type Stage = 'briefing' | 'reading' | 'recording' | 'review' | 'sent';

/**
 * The candidate's side of the surprise question, in English only.
 *
 * Everything here is built around one rule: there is a single attempt, and it
 * belongs to the server. The screen never pretends otherwise — it says so
 * before the question is opened, counts down to the server's deadline, and
 * once the answer is sent it offers no way to try again.
 *
 * No score, no hint of a decision: the candidate only ever learns that the
 * answer arrived.
 */
export function SurpriseFlow({ surprise }: { surprise: SurpriseQuestion }) {
  const recorder = useRecorder({ video: true, maxSeconds: surprise.answerSeconds });
  const [stage, setStage] = useState<Stage>('briefing');
  const [consentVideo, setConsentVideo] = useState(false);
  const [consentProcessing, setConsentProcessing] = useState(false);
  const [countdown, setCountdown] = useState(READING_SECONDS);
  const videoElement = useRef<HTMLVideoElement>(null);

  const ready = consentVideo && consentProcessing && recorder.stream !== null;
  const left = Math.max(0, surprise.answerSeconds - recorder.seconds);

  useEffect(() => {
    if (videoElement.current && recorder.stream) videoElement.current.srcObject = recorder.stream;
  }, [recorder.stream]);

  // Reading time, then the camera starts by itself: nobody has to press
  // anything at the moment they are supposed to be thinking.
  useEffect(() => {
    if (stage !== 'reading') return;
    const timer = setTimeout(() => {
      if (countdown <= 1) {
        setStage('recording');
        recorder.start();
      } else {
        setCountdown((value) => value - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, recorder, stage]);

  // The review step is simply "a clip exists": nothing to keep in sync.
  const shown: Stage = stage === 'recording' && recorder.clip ? 'review' : stage;

  if (recorder.status === 'denied' || recorder.status === 'unsupported') {
    return (
      <section className="rounded-panel border border-border-subtle bg-bg-surface p-5 text-sm">
        <h2 className="font-semibold text-text-primary">The camera is not available</h2>
        <p className="mt-1 text-text-secondary">
          This question is answered on camera. Allow the camera and the microphone and reload the page, or write to the
          admissions team — nobody is penalised for a device that does not work.
        </p>
      </section>
    );
  }

  if (shown === 'sent') {
    return (
      <section className="flex flex-col items-center gap-3 rounded-panel border border-border-subtle bg-bg-surface p-8 text-center">
        <CheckCircleIcon aria-hidden="true" className="h-7 w-7 text-brand-ink" />
        <h2 className="text-lg font-bold text-text-primary">Your answer is in</h2>
        <p className="max-w-lg text-sm text-text-secondary">
          Thank you. It goes to the people reading your application, together with everything else you have sent. There
          is nothing else to do here.
        </p>
        <Link href="/candidate" className="mt-2 text-sm font-semibold text-brand-ink hover:underline">
          Back to your home
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Once the question is out, the briefing and the consents are behind the
          candidate: what they need on screen is the question and the camera. */}
      {shown === 'briefing' ? (
      <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">Before you start</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-text-secondary">
          <li>· One attempt. The question opens once, and the recording starts on its own.</li>
          <li>· {surprise.answerSeconds} seconds to answer, in English, on camera.</li>
          <li>· {READING_SECONDS} seconds to read the question first.</li>
          <li>· Nobody expects a polished answer. Say what you actually think.</li>
        </ul>
      </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">Camera and microphone</h2>
        <div className="overflow-hidden rounded-control bg-bg-elevated">
          {/* Nothing here is recorded: it is a mirror, so you can see yourself before you begin. */}
          <video ref={videoElement} muted autoPlay playsInline className="aspect-video w-full object-cover" />
        </div>
        {recorder.stream ? (
          <p className="font-mono text-[0.68rem] text-text-muted">Camera on. Nothing is being recorded yet.</p>
        ) : (
          <button
            type="button"
            onClick={recorder.preview}
            className="w-fit rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated"
          >
            Check camera and microphone
          </button>
        )}
      </section>

      {shown === 'briefing' ? (
      <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">Your consent</h2>
        <label className="flex items-start gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={consentVideo}
            onChange={(event) => setConsentVideo(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-green"
          />
          I agree to being recorded on video for this answer. Staff at inVision U may watch it.
        </label>
        <label className="flex items-start gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={consentProcessing}
            onChange={(event) => setConsentProcessing(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-green"
          />
          I agree to my answer being transcribed and read with the rest of my application. The video itself is never
          sent to a model.
        </label>
      </section>
      ) : null}

      {shown === 'briefing' ? (
        <button
          type="button"
          disabled={!ready}
          onClick={() => setStage('reading')}
          className="w-fit rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          Show the question
        </button>
      ) : (
        <section className="flex flex-col gap-3 rounded-panel border border-brand-green bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">The question</p>
          <p className="text-[1.05rem] font-medium text-text-primary">{surprise.question}</p>

          {shown === 'reading' ? (
            <p className="font-mono text-sm tabular-nums text-text-secondary" aria-live="polite">
              Recording starts in {countdown}s
            </p>
          ) : null}

          {shown === 'recording' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-control bg-status-flag/15 px-3 py-1.5 text-sm font-semibold text-text-primary">
                <VideoCameraIcon aria-hidden="true" className="h-4 w-4" />
                Recording · <span className="font-mono tabular-nums">{left}s left</span>
              </span>
              <button
                type="button"
                onClick={recorder.stop}
                className="rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated"
              >
                Done
              </button>
            </div>
          ) : null}

          {shown === 'review' && recorder.clip ? (
            <div className="flex flex-col gap-3">
              <video controls src={recorder.clip.url} className="w-full rounded-control" aria-label="Your answer" />
              <p className="text-sm text-text-secondary">
                This is what will be sent. There is one attempt, so there is no way to record it again.
              </p>
              <button
                type="button"
                onClick={() => setStage('sent')}
                className="w-fit rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
              >
                Send my answer
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
