'use client';

import { ArrowUpTrayIcon, CheckCircleIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useRecorder } from '../../lib/media/useRecorder';
import type { PresentationInput } from '../../lib/presentation/queries';
import { PRESENTATION_MAX_SECONDS, PRESENTATION_MIN_SECONDS, PRESENTATION_PROMPT } from '../../lib/presentation/types';

/** The API's limit for the file; a bigger one is turned away here, before a long upload. */
const MAX_BYTES = 100 * 1024 * 1024;

const button =
  'w-fit rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50';
const secondary =
  'inline-flex w-fit items-center gap-1.5 rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50';

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

/** A chosen file, with its length once the browser has read it (`null` until then, or if it cannot). */
interface Upload {
  blob: Blob;
  url: string;
  seconds: number | null;
}

/**
 * The candidate's side of the video presentation, in English only.
 *
 * Unlike the surprise question, the prompt is known in advance, so the
 * candidate may record as often as they like, or upload a file they made
 * elsewhere. What is final is the sending: one presentation per candidate,
 * and once it is sent the screen offers no way to replace it.
 *
 * Nothing here scores or hints at a decision: the candidate only learns that
 * the presentation arrived.
 */
export function PresentationFlow({
  candidateId,
  alreadySent,
  onSend,
}: {
  candidateId: string;
  /** The candidate's progress already has a presentation. */
  alreadySent: boolean;
  onSend: (input: PresentationInput) => Promise<unknown>;
}) {
  const [sent, setSent] = useState(alreadySent);
  const [consentVideo, setConsentVideo] = useState(false);
  const [consentProcessing, setConsentProcessing] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const recorder = useRecorder({ video: true, maxSeconds: PRESENTATION_MAX_SECONDS });
  const consented = consentVideo && consentProcessing;

  // The object URL lives as long as its file is the chosen one; reading the length does not replace it.
  const uploadUrl = upload?.url;
  useEffect(() => {
    if (!uploadUrl) return;
    return () => URL.revokeObjectURL(uploadUrl);
  }, [uploadUrl]);

  // The mirror comes and goes with the preview, so it takes the stream each time it appears.
  const mirror = (element: HTMLVideoElement | null) => {
    if (element && recorder.stream && element.srcObject !== recorder.stream) element.srcObject = recorder.stream;
  };

  // What would be sent: the recording, or the file — whichever came last.
  const recorded = recorder.clip ? { blob: recorder.clip.blob, url: recorder.clip.url, seconds: recorder.seconds } : null;
  const take = upload ?? recorded;
  const tooShort = take?.seconds != null && take.seconds < PRESENTATION_MIN_SECONDS;
  const tooLong = upload?.seconds != null && upload.seconds > PRESENTATION_MAX_SECONDS + 1;
  const tooBig = take !== null && take.blob.size > MAX_BYTES;
  const problem = tooBig
    ? 'The file is over 100 MB. Record it here instead, or make it smaller.'
    : tooLong
      ? 'The video is longer than three minutes. Keep it to three minutes or less.'
      : tooShort
        ? 'The presentation needs at least one minute. Record it again, or choose a longer file.'
        : null;

  function chooseFile(file: File | undefined) {
    if (!file) return;
    recorder.discard();
    const url = URL.createObjectURL(file);
    setError(null);
    setUpload({ blob: file, url, seconds: null });
    // The browser reads the length from the file itself; the server checks it again.
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () =>
      setUpload((current) => (current?.url === url && Number.isFinite(probe.duration) ? { ...current, seconds: probe.duration } : current));
    probe.src = url;
  }

  function recordAgain() {
    setUpload(null);
    recorder.discard();
    setError(null);
  }

  function startRecording() {
    setUpload(null);
    setError(null);
    recorder.start();
  }

  async function send() {
    if (!take) return;
    setBusy(true);
    setError(null);
    try {
      await onSend({ candidateId, video: take.blob, consentVideo, consentProcessing });
      recorder.release();
      setSent(true);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'PRESENTATION_EXISTS') setSent(true);
      else setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-panel border border-border-subtle bg-bg-surface p-8 text-center">
        <CheckCircleIcon aria-hidden="true" className="h-7 w-7 text-brand-ink" />
        <h2 className="text-lg font-bold text-text-primary">Your presentation is in</h2>
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

  const recording = recorder.status === 'recording';
  const cameraProblem = recorder.status === 'denied' || recorder.status === 'unsupported';

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-panel border border-brand-green bg-bg-surface p-5">
        <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">What to talk about</p>
        <p className="text-[1.05rem] font-medium text-text-primary">{PRESENTATION_PROMPT}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-text-secondary">
          <li>· One to three minutes, in English, on camera.</li>
          <li>· Record it here, or upload a video you made yourself (webm or mp4, up to 100 MB).</li>
          <li>· Watch it before you send it, and record again as many times as you like. You send it once.</li>
          <li>· Grammar mistakes do not count against you: English is looked at separately from leadership.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">Your consent</h2>
        <label className="flex items-start gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={consentVideo}
            onChange={(event) => setConsentVideo(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-green"
          />
          I agree to sending this video. Staff at inVision U may watch it.
        </label>
        <label className="flex items-start gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={consentProcessing}
            onChange={(event) => setConsentProcessing(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-green"
          />
          I agree to my presentation being transcribed and read with the rest of my application. The video itself is
          never sent to a model.
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">{take ? 'Watch it before you send it' : 'Record or upload'}</h2>

        {take && !recording ? (
          <video controls src={take.url} className="w-full rounded-control bg-bg-elevated" aria-label="Your presentation" />
        ) : (
          <div className="overflow-hidden rounded-control bg-bg-elevated">
            {/* A mirror before anything is recorded; the recording starts only on the button. */}
            <video ref={mirror} muted autoPlay playsInline style={{ transform: 'scaleX(-1)' }} className="aspect-video w-full object-cover" />
          </div>
        )}

        {cameraProblem ? (
          <p className="text-sm text-text-secondary">
            The camera is not available here. Allow the camera and the microphone and reload the page, or upload a video
            you recorded on another device.
          </p>
        ) : null}

        {recording ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-control bg-status-flag/15 px-3 py-1.5 text-sm font-semibold text-text-primary">
              <VideoCameraIcon aria-hidden="true" className="h-4 w-4" />
              Recording ·{' '}
              <span className="font-mono tabular-nums" aria-live="off">
                {clock(recorder.seconds)} / {clock(PRESENTATION_MAX_SECONDS)}
              </span>
            </span>
            <button type="button" onClick={recorder.stop} className={secondary}>
              Done
            </button>
            {recorder.seconds < PRESENTATION_MIN_SECONDS ? (
              <span className="text-[0.8rem] text-text-muted">At least {clock(PRESENTATION_MIN_SECONDS)}.</span>
            ) : null}
          </div>
        ) : take ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              {take.seconds != null ? (
                <>
                  Length <span className="font-mono tabular-nums">{clock(take.seconds)}</span>.{' '}
                </>
              ) : null}
              This is what will be sent. Once it is sent, it cannot be replaced.
            </p>
            {problem ? (
              <p role="alert" className="text-sm font-semibold text-text-primary">
                {problem}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy || !consented || problem !== null} onClick={() => void send()} className={button}>
                {busy ? 'Sending…' : error ? 'Try again' : 'Send my presentation'}
              </button>
              <button type="button" disabled={busy} onClick={recordAgain} className={secondary}>
                Start over
              </button>
            </div>
            {!consented ? <p className="text-[0.8rem] text-text-muted">Tick both boxes above to send it.</p> : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {recorder.stream ? (
              <button type="button" onClick={startRecording} className={button}>
                Start recording
              </button>
            ) : (
              <button type="button" disabled={cameraProblem} onClick={recorder.preview} className={secondary}>
                <VideoCameraIcon aria-hidden="true" className="h-4 w-4" />
                Check camera and microphone
              </button>
            )}
            <button type="button" onClick={() => fileInput.current?.click()} className={secondary}>
              <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />
              Upload a video
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="video/webm,video/mp4,video/quicktime"
              className="sr-only"
              aria-label="Upload a video"
              onChange={(event) => {
                chooseFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>
        )}
      </section>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {error}
        </p>
      ) : null}
    </div>
  );
}
