'use client';

import { useState } from 'react';
import { setTextMode, useWorld, type CandidateCode } from '../../lib/demo/world';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: {
    title: 'How each candidate answers',
    lede: 'The simulation is spoken. Switch typing on for a candidate who has no microphone or a speech difficulty — with the reason, because it is recorded and shown on the report. It changes nothing about how the conversation is read.',
    speaks: 'Speaks',
    types: 'Types',
    reason: 'Reason',
    reasonPlaceholder: 'No microphone available',
    switchOn: 'Switch typing on',
    switchOff: 'Back to speaking',
    started: 'The simulation has started — this can no longer be changed.',
    candidate: 'Candidate',
  },
  ru: {
    title: 'Как отвечает каждый кандидат',
    lede: 'Симуляция голосовая. Текстовый режим включается кандидату без микрофона или с нарушением речи — с причиной: она сохраняется и видна в отчёте. На то, как читают разговор, это не влияет.',
    speaks: 'Говорит',
    types: 'Печатает',
    reason: 'Причина',
    reasonPlaceholder: 'Нет микрофона',
    switchOn: 'Включить текст',
    switchOff: 'Вернуть голос',
    started: 'Симуляция началась — это уже нельзя изменить.',
    candidate: 'Кандидат',
  },
};

/**
 * The accommodation, in the hands of staff rather than the candidate. The
 * server holds the same two rules: a reason is required, and nothing changes
 * once the simulation has started (`409 SIMULATION_STARTED`).
 */
export function AccommodationControl() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const world = useWorld();
  const [reasons, setReasons] = useState<Partial<Record<CandidateCode, string>>>({});

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-text-primary">{text.title}</h2>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </div>

      <ul className="flex flex-col divide-y divide-border-subtle">
        {(['A', 'B', 'C'] as const).map((code) => {
          const accommodation = world.accommodations[code];
          const started = world.candidates[code].simulation !== 'not-started';
          const reason = reasons[code] ?? accommodation.reason;

          return (
            <li key={code} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-28 font-semibold text-text-primary">
                {text.candidate} {code}
              </span>
              <span className="font-mono text-[0.62rem] tracking-[0.12em] text-text-muted uppercase">
                {accommodation.textMode ? text.types : text.speaks}
              </span>

              {accommodation.textMode ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                    {text.reason}: {accommodation.reason}
                  </span>
                  <button
                    type="button"
                    disabled={started}
                    onClick={() => setTextMode(code, false, '')}
                    className="rounded-control border border-border-strong px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {text.switchOff}
                  </button>
                </>
              ) : (
                <>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">{text.reason}</span>
                    <input
                      value={reason}
                      disabled={started}
                      onChange={(event) => setReasons((current) => ({ ...current, [code]: event.target.value }))}
                      placeholder={text.reasonPlaceholder}
                      className="w-full rounded-control border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong disabled:cursor-not-allowed"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={started || reason.trim().length === 0}
                    onClick={() => setTextMode(code, true, reason.trim())}
                    className="rounded-control border border-border-strong px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {text.switchOn}
                  </button>
                </>
              )}

              {started ? <span className="w-full text-[0.72rem] text-text-muted">{text.started}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
