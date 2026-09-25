'use client';

import { CheckCircleIcon, ClockIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useRecorder } from '../../lib/media/useRecorder';
import type { SurpriseAnswerInput } from '../../lib/surprise/queries';
import type { SurpriseQuestion } from '../../lib/surprise/types';

/** Ten seconds between reading the question and the camera starting. */
const READING_SECONDS = 10;

type Stage = 'briefing' | 'reading' | 'recording' | 'resume' | 'sent' | 'expired';

function initialStage(status: SurpriseQuestion['status']): Stage {
  if (status === 'ready') return 'briefing';
  if (status === 'started') return 'resume';
  if (status === 'expired') return 'expired';
  return 'sent';
}

function secondsUntil(deadline: string | null, now: number): number {
  return deadline ? Math.floor((Date.parse(deadline) - now) / 1000) : 0;
}

const button =
  'w-fit rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The candidate's side of the surprise question, in English only.
 *
 * Everything here is built around one rule: there is a single attempt, and it
 * belongs to the server. The screen never pretends otherwise — it says so
 * before the question is opened, records against the server's deadline, and
 * once the answer is sent it offers no way to try again. A page reloaded
 * after the question was opened picks up where the attempt is, with the time
 * that is left, rather than offering a fresh one.
 *
 * No score, no hint of a decision: the candidate only ever learns that the
 * answer arrived.
 */
export function SurpriseFlow({
  surprise,
  onStart,
  onSend,
}: {
  /** As the server had it when the page opened; from then on the screen keeps its own stage. */
  surprise: SurpriseQuestion;
  onStart: () => Promise<SurpriseQuestion>;
  onSend: (input: SurpriseAnswerInput) => Promise<unknown>;
}) {
  const [stage, setStage] = useState<Stage>(() => initialStage(surprise.status));
  const [opened, setOpened] = useState(surprise);
  const [resumed] = useState(surprise.status === 'started');
  const [consentVideo, setConsentVideo] = useState(false);
  const [consentProcessing, setConsentProcessing] = useState(false);
  const [countdown, setCountdown] = useState(READING_SECONDS);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoElement = useRef<HTMLVideoElement>(null);

  // Picked up after a reload, the attempt has only what is left before the server's deadline.
  const limit = resumed ? Math.max(0, Math.min(opened.answerSeconds, secondsUntil(opened.answerDeadline, now))) : opened.answerSeconds;
  const recorder = useRecorder({ video: true, maxSeconds: Math.max(1, limit) });
  const consented = consentVideo && consentProcessing;
  const ready = consented && recorder.stream !== null;
  const left = Math.max(0, limit - recorder.seconds);

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

  // A resumed attempt shows the time that is left, and ends with it. The
  // clock holds still once recording starts: the recorder counts from there.
  const waiting = stage === 'resume' && recorder.status !== 'recording' && recorder.clip === null;
  const timeUp = waiting && limit <= 0;
  useEffect(() => {
    if (!waiting || timeUp) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timeUp, waiting]);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      setOpened(await onStart());
      setStage('reading');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  async function send(clip: Blob) {
    setBusy(true);
    setError(null);
    try {
      await onSend({ clip, consentVideo, consentProcessing });
      recorder.release();
      setStage('sent');
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'DEADLINE_PASSED') setStage('expired');
      else if (failure instanceof ApiError && failure.code === 'ALREADY_ANSWERED') setStage('sent');
      else setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  // The review step is simply "a clip exists": nothing to keep in sync.
  const reviewing = (stage === 'recording' || stage === 'resume') && recorder.clip !== null;

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

  if (stage === 'sent' || stage === 'expired' || timeUp) {
    const sent = stage === 'sent';
    return (
      <section className="flex flex-col items-center gap-3 rounded-panel border border-border-subtle bg-bg-surface p-8 text-center">
        {sent ? (
          <CheckCircleIcon aria-hidden="true" className="h-7 w-7 text-brand-ink" />
        ) : (
          <ClockIcon aria-hidden="true" className="h-7 w-7 text-text-muted" />
        )}
        <h2 className="text-lg font-bold text-text-primary">{sent ? 'Your answer is in' : 'The time for this question is over'}</h2>
        <p className="max-w-lg text-sm text-text-secondary">
          {sent
            ? 'Thank you. It goes to the people reading your application, together with everything else you have sent. There is nothing else to do here.'
            : 'The question was opened, and the time to answer it has passed. There is one attempt, so it cannot be opened again. The rest of your application is not affected by this screen.'}
        </p>
        <Link href="/candidate" className="mt-2 text-sm font-semibold text-brand-ink hover:underline">
          Back to your home
        </Link>
      </section>
    );
  }

  const showConsents = stage === 'briefing' || (stage === 'resume' && recorder.status !== 'recording' && !reviewing);

  return (
    <div className="flex flex-col gap-5">
      {/* Once the question is out, the briefing is behind the candidate: what
          they need on screen is the question and the camera. */}
      {stage === 'briefing' ? (
        <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary">Before you start</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-text-secondary">
            <li>· One attempt. The question opens once, and the recording starts on its own.</li>
            <li>· {opened.answerSeconds} seconds to answer, in English, on camera.</li>
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
          <p className="font-mono text-[0.68rem] text-text-muted">
            {recorder.status === 'recording' ? 'Recording.' : 'Camera on. Nothing is being recorded yet.'}
          </p>
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

      {showConsents ? (
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

      {stage === 'briefing' ? (
        <button type="button" disabled={!ready || busy} onClick={() => void open()} className={button}>
          Show the question
        </button>
      ) : (
        <section className="flex flex-col gap-3 rounded-panel border border-brand-green bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">The question</p>
          <p className="text-[1.05rem] font-medium text-text-primary">{opened.question}</p>

          {stage === 'reading' ? (
            <p className="font-mono text-sm tabular-nums text-text-secondary" aria-live="polite">
              Recording starts in {countdown}s
            </p>
          ) : null}

          {stage === 'resume' && recorder.status !== 'recording' && !reviewing ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-secondary" aria-live="polite">
                You opened this question earlier. <span className="font-mono tabular-nums">{limit}s</span> are left to
                record and send your answer.
              </p>
              <button type="button" disabled={!ready} onClick={recorder.start} className={button}>
                Start recording
              </button>
            </div>
          ) : null}

          {recorder.status === 'recording' ? (
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

          {reviewing && recorder.clip ? (
            <div className="flex flex-col gap-3">
              <video controls src={recorder.clip.url} className="w-full rounded-control" aria-label="Your answer" />
              <p className="text-sm text-text-secondary">
                This is what will be sent. There is one attempt, so there is no way to record it again.
              </p>
              <button type="button" disabled={busy || !consented} onClick={() => void send(recorder.clip!.blob)} className={button}>
                {busy ? 'Sending…' : error ? 'Try again' : 'Send my answer'}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {error}
        </p>
      ) : null}
    </div>
  );
}
