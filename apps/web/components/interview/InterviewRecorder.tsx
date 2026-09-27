'use client';

import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { useCopy } from '../../lib/i18n/StaffLocaleProvider';
import { silentWav } from '../../lib/media/silentWav';

const copy = {
  en: {
    consent: 'The candidate agreed to this interview being recorded and transcribed.',
    check: 'Check the microphone',
    checking: 'Asking the browser for the microphone…',
    ready: 'The microphone is ready. Say a few words: the bar should move.',
    denied: 'The browser blocked the microphone. Allow it for this site — the lock icon in the address bar — and check again.',
    record: 'Record the interview',
    stop: 'Stop and transcribe',
    recording: 'Recording',
    sample: 'Use the demo recording',
    noMic: 'The microphone is not available here. Use the demo recording instead.',
    privacy: 'Only the text reaches the model. The recording is deleted once it is transcribed.',
  },
  ru: {
    consent: 'Кандидат согласился на запись и расшифровку интервью.',
    check: 'Проверить микрофон',
    checking: 'Запрашиваем доступ к микрофону…',
    ready: 'Микрофон готов. Скажите пару слов — полоска должна двигаться.',
    denied: 'Браузер запретил доступ к микрофону. Разрешите его для этого сайта (значок замка в адресной строке) и проверьте ещё раз.',
    record: 'Записать интервью',
    stop: 'Остановить и расшифровать',
    recording: 'Идёт запись',
    sample: 'Взять демо-запись',
    noMic: 'Микрофон здесь недоступен. Возьмите демо-запись.',
    privacy: 'В модель уходит только текст. Запись удаляется сразу после расшифровки.',
  },
};

type Microphone = 'unchecked' | 'checking' | 'ready' | 'denied' | 'unavailable';

/** webm where the browser has it, ogg elsewhere; the API takes both, and wav. */
function audioType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported?.(type));
}

/**
 * Records the live interview on the interviewer's device, with the
 * candidate's consent, and hands the audio over for transcription. The
 * microphone is asked for and checked first, with its level on screen, and
 * nothing is recorded before the consent box is ticked; the demo recording
 * needs the consent too, because it goes through the same upload.
 */
export function InterviewRecorder({ onRecorded, disabled = false }: { onRecorded: (audio: Blob) => void; disabled?: boolean }) {
  const text = useCopy(copy);
  const [consent, setConsent] = useState(false);
  const [microphone, setMicrophone] = useState<Microphone>('unchecked');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const frame = useRef<number | null>(null);

  function release() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    void audio.current?.close();
    frame.current = null;
    stream.current = null;
    audio.current = null;
  }

  useEffect(() => release, []);

  // A microphone the browser has already refused is said so before anyone asks.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === 'denied') setMicrophone('denied');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [recording]);

  /**
   * Asks for the microphone before anything is recorded, and shows its level,
   * so a refused or silent microphone is found out now — not an hour into
   * the interview.
   */
  async function check() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicrophone('unavailable');
      return;
    }
    release();
    setMicrophone('checking');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setMicrophone(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      return;
    }
    if (typeof AudioContext !== 'undefined') {
      audio.current = new AudioContext();
      const analyser = audio.current.createAnalyser();
      analyser.fftSize = 512;
      audio.current.createMediaStreamSource(stream.current).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        frame.current = requestAnimationFrame(tick);
      };
      tick();
    }
    setMicrophone('ready');
  }

  function start() {
    if (!stream.current) return;
    const type = audioType();
    recorder.current = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    chunks.current = [];
    recorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    recorder.current.onstop = () => {
      const media = recorder.current;
      onRecorded(new Blob(chunks.current, { type: media?.mimeType || type || 'audio/webm' }));
      release();
      setMicrophone('unchecked');
    };
    recorder.current.start(1000);
    setSeconds(0);
    setRecording(true);
  }

  function stop() {
    setRecording(false);
    recorder.current?.stop();
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const meter = (
    <div className="h-1.5 overflow-hidden rounded-full bg-border-subtle" aria-hidden="true">
      <div className="h-full rounded-full bg-brand-green transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 p-5">
      {recording ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-status-low">
              <span className="h-2 w-2 animate-pulse rounded-full bg-status-low" />
              {text.recording}
            </span>
            <time className="font-mono text-sm tabular-nums text-text-primary">
              {mm}:{ss}
            </time>
          </div>
          {meter}
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
          >
            <StopIcon aria-hidden="true" className="h-4 w-4" />
            {text.stop}
          </button>
        </>
      ) : (
        <>
          <label className="flex items-start gap-2.5 text-[0.82rem] text-text-secondary">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--brand-ink)]"
            />
            {text.consent}
          </label>

          {microphone === 'ready' ? (
            <>
              <p role="status" className="text-[0.8rem] text-text-secondary">
                {text.ready}
              </p>
              {meter}
              <button
                type="button"
                onClick={start}
                disabled={!consent || disabled}
                className="inline-flex items-center justify-center gap-2 rounded-control bg-brand-green px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MicrophoneIcon aria-hidden="true" className="h-4 w-4" />
                {text.record}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void check()}
              disabled={disabled || microphone === 'checking'}
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MicrophoneIcon aria-hidden="true" className="h-4 w-4" />
              {microphone === 'checking' ? text.checking : text.check}
            </button>
          )}
          {microphone === 'denied' ? <p role="alert" className="text-[0.8rem] text-status-low">{text.denied}</p> : null}
          {microphone === 'unavailable' ? <p role="alert" className="text-[0.8rem] text-status-low">{text.noMic}</p> : null}

          <button
            type="button"
            onClick={() => onRecorded(silentWav())}
            disabled={!consent || disabled}
            className="self-start text-[0.8rem] font-medium text-brand-ink underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {text.sample}
          </button>
        </>
      )}
      <p className="text-[0.72rem] text-text-muted">{text.privacy}</p>
    </div>
  );
}
