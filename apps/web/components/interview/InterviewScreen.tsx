'use client';

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { competencies, competencyOrder } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { sampleScores } from '../../lib/interview/preview';
import type { Interview } from '../../lib/interview/useInterview';
import { Button } from '../ui/Button';
import { DraftComparison } from './DraftComparison';
import { InterviewNotes } from './InterviewNotes';
import { LockedDraft } from './LockedDraft';
import { ScoreInput } from './ScoreInput';

const copy = {
  en: {
    preview: 'Preview · a scripted draft — the real one arrives with M4',
    fill: 'Fill sample scores',
    eyebrow: 'Interview',
    candidate: 'Candidate',
    held: 'Held',
    yourScores: 'Your scores',
    lede: '0–4 per competency, or “not enough to judge”. You score blind: no AI opinion is on this page yet.',
    notEnough: 'Not enough to judge',
    progress: (done: number) => `${done} of 5 set`,
    save: 'Save my scores',
    saved: 'Saved. Your scores are now fixed, so the comparison stays honest.',
    draftTitle: 'AI draft and differences',
    draftLede: 'Built from your interview notes. It proposes; you and the commission decide.',
    loading: 'Loading the draft…',
  },
  ru: {
    preview: 'Превью · заготовленный черновик — настоящий появится в M4',
    fill: 'Заполнить примером',
    eyebrow: 'Интервью',
    candidate: 'Кандидат',
    held: 'Проведено',
    yourScores: 'Ваши баллы',
    lede: '0–4 по каждой компетенции или «недостаточно данных». Вы оцениваете вслепую: мнения ИИ на этой странице пока нет.',
    notEnough: 'Недостаточно данных',
    progress: (done: number) => `Заполнено ${done} из 5`,
    save: 'Сохранить мои баллы',
    saved: 'Сохранено. Баллы зафиксированы, чтобы сравнение оставалось честным.',
    draftTitle: 'Черновик ИИ и расхождения',
    draftLede: 'Собран по вашим заметкам интервью. Он предлагает — решаете вы и комиссия.',
    loading: 'Загружаем черновик…',
  },
};

/**
 * M4: the interviewer commits to their own view, and only then sees what the
 * AI drafted and where the two differ. The draft is not in the page until the
 * save succeeds — the hook never asks for it earlier.
 */
export function InterviewScreen({ state }: { state: Interview }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const { interview, phase, scores, complete, draft, error, preview } = state;
  const done = competencyOrder.filter((competency) => scores[competency] !== undefined).length;
  const held = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
    new Date(interview.heldAt),
  );

  return (
    <>
      {preview ? (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-border-subtle bg-bg-elevated px-5 py-1.5">
          <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">{text.preview}</p>
          {phase === 'scoring' ? (
            <button
              type="button"
              onClick={() => state.fill(sampleScores)}
              className="font-mono text-[0.6rem] tracking-[0.12em] text-brand-ink uppercase underline-offset-2 hover:underline"
            >
              {text.fill}
            </button>
          ) : null}
        </div>
      ) : null}

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">
            {text.candidate} {interview.candidate.code}
          </h1>
          <p className="text-sm text-text-secondary">
            {text.held}: {held} UTC
          </p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-6">
            <section aria-labelledby="scores-title" className="rounded-panel border border-border-subtle bg-bg-surface">
              <header className="border-b border-border-subtle px-5 py-3">
                <h2 id="scores-title" className="text-sm font-semibold text-text-primary">
                  {text.yourScores}
                </h2>
                <p className="text-[0.75rem] text-text-muted">{text.lede}</p>
              </header>

              <ul className="divide-y divide-border-subtle">
                {competencyOrder.map((competency) => (
                  <li key={competency} className="@container px-5 py-3.5">
                    <div className="flex flex-col gap-2.5 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-bg-elevated font-mono text-[0.75rem] font-bold text-text-primary">
                          {competency}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{competencies[competency].name}</p>
                          <p className="text-[0.75rem] text-text-muted">{competencies[competency].looksFor[locale]}</p>
                        </div>
                      </div>
                      <ScoreInput
                        label={competencies[competency].name}
                        value={scores[competency]}
                        onChange={(score) => state.setScore(competency, score)}
                        disabled={phase !== 'scoring'}
                        notEnough={text.notEnough}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
                {phase === 'saved' ? (
                  <p className="flex items-center gap-2 text-sm text-brand-ink">
                    <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
                    {text.saved}
                  </p>
                ) : (
                  <>
                    <p className="font-mono text-[0.68rem] text-text-muted" aria-live="polite">
                      {text.progress(done)}
                    </p>
                    <Button type="button" onClick={() => void state.save()} disabled={!complete} loading={phase === 'saving'}>
                      {text.save}
                    </Button>
                  </>
                )}
              </footer>
              {error ? <p className="px-5 pb-3 text-sm text-status-low">{error}</p> : null}
            </section>

            <section aria-labelledby="draft-title" className="flex flex-col gap-3">
              <div>
                <h2 id="draft-title" className="text-sm font-semibold text-text-primary">
                  {text.draftTitle}
                </h2>
                <p className="text-[0.75rem] text-text-muted">{text.draftLede}</p>
              </div>
              {phase !== 'saved' ? (
                <LockedDraft />
              ) : draft ? (
                <DraftComparison yours={scores} draft={draft} />
              ) : (
                <p className="text-sm text-text-muted">{text.loading}</p>
              )}
            </section>
          </div>

          <div className="lg:sticky lg:top-6">
            <InterviewNotes notes={interview.notes} />
          </div>
        </div>
      </main>
    </>
  );
}
