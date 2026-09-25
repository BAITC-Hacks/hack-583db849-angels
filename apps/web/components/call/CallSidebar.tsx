'use client';

import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { candidateById, useCandidates } from '../../lib/api/candidates';
import { errorText } from '../../lib/api/errors';
import { useBrief } from '../../lib/brief/queries';
import { competencies, competencyOrder } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useInterviewRecord } from '../../lib/interview/queries';
import type { InterviewRecord } from '../../lib/interview/types';
import { useInterviewSession } from '../../lib/interview/useInterview';
import { useSaveNotes } from '../../lib/slots/queries';
import { focusName } from '../brief/BriefSections';
import { ScoreInput } from '../interview/ScoreInput';

const copy = {
  en: {
    tabs: { questions: 'Questions', notes: 'Notes', scores: 'Scores' },
    noBrief: 'The brief is not ready yet.',
    why: 'Why',
    notePlaceholder: 'What they said or did, in a line or two',
    addNote: 'Add note',
    remove: 'Remove note',
    noNotes: 'No notes yet. They go to the AI draft as context, never as a verdict.',
    notesFixed: 'Your scores are saved, so the notes are fixed.',
    saving: 'Saving…',
    saved: 'Saved',
    scoresLede: 'Score blind, as on the interview page: no AI view is shown here. 0–4, or “not enough to judge”.',
    notEnough: 'Not enough to judge',
    save: 'Save my scores',
    scoresSaved: 'Saved and fixed. The draft and the differences open on the interview page.',
  },
  ru: {
    tabs: { questions: 'Вопросы', notes: 'Заметки', scores: 'Баллы' },
    noBrief: 'Бриф ещё не готов.',
    why: 'Почему',
    notePlaceholder: 'Что кандидат сказал или сделал, в одну-две строки',
    addNote: 'Добавить заметку',
    remove: 'Удалить заметку',
    noNotes: 'Заметок пока нет. Они идут в черновик ИИ как контекст, а не как вердикт.',
    notesFixed: 'Баллы сохранены, поэтому заметки зафиксированы.',
    saving: 'Сохраняем…',
    saved: 'Сохранено',
    scoresLede: 'Оценивайте вслепую, как на странице интервью: мнения ИИ здесь нет. 0–4 или «недостаточно данных».',
    notEnough: 'Недостаточно данных',
    save: 'Сохранить мои баллы',
    scoresSaved: 'Сохранено и зафиксировано. Черновик и расхождения — на странице интервью.',
  },
};

type Tab = 'questions' | 'notes' | 'scores';

/**
 * What the interviewer has beside the call: the brief's questions, notes as
 * they go, and their own blind scores. The draft is not here — it opens on
 * the interview page after the scores are saved, as everywhere.
 */
export function CallSidebar({ interviewId, candidateId }: { interviewId: string; candidateId: string }) {
  const text = copy[useStaffLocale().locale];
  const [tab, setTab] = useState<Tab>('questions');
  const record = useInterviewRecord(interviewId);

  return (
    <aside className="flex flex-col rounded-panel border border-border-subtle bg-bg-surface lg:max-h-[calc(100vh-6rem)]">
      <div role="tablist" className="flex shrink-0 border-b border-border-subtle">
        {(['questions', 'notes', 'scores'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === id ? 'border-b-2 border-brand-green text-text-primary' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {text.tabs[id]}
          </button>
        ))}
      </div>
      {/* All three stay mounted, so scores set but not saved survive a look at the questions. */}
      <div role="tabpanel" hidden={tab !== 'questions'} className="flex-col gap-3 overflow-y-auto p-4 [&:not([hidden])]:flex">
        <Questions candidateId={candidateId} />
      </div>
      <div role="tabpanel" hidden={tab !== 'notes'} className="flex-col gap-3 overflow-y-auto p-4 [&:not([hidden])]:flex">
        {record.data ? <Notes key={interviewId} record={record.data} /> : null}
      </div>
      <div role="tabpanel" hidden={tab !== 'scores'} className="flex-col gap-3 overflow-y-auto p-4 [&:not([hidden])]:flex">
        {record.data ? <Scores record={record.data} /> : null}
      </div>
    </aside>
  );
}

function Questions({ candidateId }: { candidateId: string }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const candidates = useCandidates();
  const brief = useBrief(candidateId, candidateById(candidates.data, candidateId)?.progress?.brief);

  if (!brief.data) return <p className="text-sm text-text-secondary">{text.noBrief}</p>;
  return (
    <ol className="flex flex-col gap-3">
      {brief.data.questions.map((item) => {
        const { letter, Icon, name } = focusName(item.focus, locale);
        return (
          <li key={item.question} className="flex gap-2.5">
            <span
              title={name}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-bg-elevated font-mono text-[0.7rem] font-bold text-text-primary"
            >
              {letter ?? (Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5" /> : null)}
            </span>
            <div className="flex flex-col gap-0.5">
              <p lang="en" className="text-sm font-medium text-text-primary">
                {item.question}
              </p>
              <p className="text-[0.75rem] text-text-muted">
                {text.why}: {item.why}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Notes({ record }: { record: InterviewRecord }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const [notes, setNotes] = useState(() => record.notes.map((note) => note.text));
  const [draft, setDraft] = useState('');
  const save = useSaveNotes(record.view.interviewId);
  const fixed = record.savedScores !== null;

  // Every change goes to the server as the whole list, so the draft always reads what is on screen.
  function change(next: string[]) {
    setNotes(next);
    save.mutate(next);
  }

  return (
    <>
      {fixed ? <p className="text-[0.8rem] text-text-muted">{text.notesFixed}</p> : null}
      {notes.length === 0 ? <p className="text-sm text-text-secondary">{text.noNotes}</p> : null}
      <ul className="flex flex-col gap-2">
        {notes.map((note, index) => (
          <li key={`${index}-${note}`} className="flex items-start gap-2 rounded-control bg-bg-elevated px-3 py-2 text-sm text-text-primary">
            <span className="flex-1 whitespace-pre-wrap">{note}</span>
            {!fixed ? (
              <button
                type="button"
                aria-label={text.remove}
                onClick={() => change(notes.filter((_, at) => at !== index))}
                className="text-text-muted hover:text-text-primary"
              >
                <XMarkIcon aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!fixed ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            change([...notes, draft.trim()]);
            setDraft('');
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder={text.notePlaceholder}
            aria-label={text.addNote}
            className="rounded-control border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[0.68rem] text-text-muted" aria-live="polite">
              {save.isPending ? text.saving : save.isError ? errorText(save.error, locale) : save.isSuccess ? text.saved : ''}
            </p>
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-control border border-border-strong px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:opacity-50"
            >
              {text.addNote}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function Scores({ record }: { record: InterviewRecord }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const state = useInterviewSession(record);

  return (
    <>
      <p className="text-[0.75rem] text-text-muted">{text.scoresLede}</p>
      <ul className="flex flex-col gap-3">
        {competencyOrder.map((competency) => (
          <li key={competency} className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-text-primary">
              <span className="font-mono">{competency}</span> · {competencies[competency].name}
            </p>
            <ScoreInput
              label={competencies[competency].name}
              value={state.scores[competency]}
              onChange={(score) => state.setScore(competency, score)}
              disabled={state.phase !== 'scoring'}
              notEnough={text.notEnough}
            />
          </li>
        ))}
      </ul>
      {state.phase === 'saved' ? (
        <p className="flex items-start gap-2 text-sm text-brand-ink">
          <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {text.scoresSaved}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void state.save()}
          disabled={!state.complete || state.phase === 'saving'}
          className="w-fit rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          {text.save}
        </button>
      )}
      {state.error ? <p className="text-sm text-status-low">{state.error}</p> : null}
    </>
  );
}
