'use client';

import { useEffect, useState } from 'react';
import type { CallRoom } from '../../lib/call/useCallRoom';
import { useAnswerClip } from '../../lib/call/useAnswerClip';
import { useFollowUps, useMarkFollowUp, useSuggestFollowUp, type FollowUp, type FollowUpSuggestion } from '../../lib/call/followUps';
import { ApiError } from '../../lib/api/client';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { InterviewerBrief } from '../../lib/brief/types';

const copy = {
  en: {
    title: 'Follow-up', answering: 'Answering:', none: 'None selected', listen: 'Listen to the answer',
    suggest: 'Suggest a follow-up', thinking: 'Thinking…', recording: 'Listening to the candidate',
    short: 'Too short to suggest anything', empty: 'Nothing to add — the answer is specific. Carry on with the brief.',
    unsupported: 'The candidate’s audio is not available to record here.',
    unavailable: "No suggestion this time. Carry on with the brief's questions.",
    limit: 'The follow-up limit for this interview has been reached.', speech: 'Could not recognise the answer. Try again.',
    previous: 'Earlier follow-ups', asked: 'Asked', dismiss: 'Dismiss', dismissed: 'Dismissed',
    sample: 'Use the demo answer', retry: 'Try again', sendClip: 'Suggest from clip', discard: 'Discard clip',
    why: 'Why', quote: 'Answer', application: 'Application', test: 'Test',
    reasons: { mismatch: "Doesn't match the application", vague: 'No specifics yet', no_evidence: 'No evidence for this letter yet' },
  },
  ru: {
    title: 'Уточняющий вопрос', answering: 'Ответ на:', none: 'Не выбрано', listen: 'Слушать ответ',
    suggest: 'Предложить уточняющий вопрос', thinking: 'Думаем…', recording: 'Слушаем кандидата',
    short: 'Ответ слишком короткий для подсказки', empty: 'Дополнить нечего — ответ конкретный. Продолжайте по брифу.',
    unsupported: 'Здесь не удалось записать звук кандидата.',
    unavailable: 'Сейчас нет подсказки. Продолжайте с вопросами из брифа.',
    limit: 'Лимит уточнений для этого интервью исчерпан.', speech: 'Не удалось распознать ответ. Попробуйте ещё раз.',
    previous: 'Прошлые уточнения', asked: 'Задано', dismiss: 'Пропустить', dismissed: 'Пропущено',
    sample: 'Использовать демо-ответ', retry: 'Повторить', sendClip: 'Предложить по записи', discard: 'Удалить запись',
    why: 'Зачем', quote: 'Ответ', application: 'Анкета', test: 'Тест',
    reasons: { mismatch: 'Расходится с анкетой', vague: 'Пока нет конкретики', no_evidence: 'Пока нет примера для этой буквы' },
  },
};

/** This component is mounted only by the interviewer's call sidebar. */
export function FollowUpPanel({ room, interviewId, candidateLabel, brief, enabled }: {
  room: CallRoom; interviewId: string; candidateLabel: string; brief?: InterviewerBrief; enabled: boolean;
}) {
  const text = copy[useStaffLocale().locale];
  const clip = useAnswerClip();
  const followUps = useFollowUps(interviewId, enabled);
  const suggest = useSuggestFollowUp(interviewId);
  const mark = useMarkFollowUp(interviewId);
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState('');
  const [hidden, setHidden] = useState(false);
  const [latest, setLatest] = useState<string | null>(null);
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null);
  const { recording, clip: recordedClip, discard } = clip;
  const allowed = enabled && !hidden && room.state === 'connected' && room.otherHere;

  useEffect(() => {
    if (!allowed && (recording || recordedClip)) discard();
  }, [allowed, recording, recordedClip, discard]);
  const candidateTrack = room.otherAudio?.mediaStreamTrack;
  useEffect(() => {
    if (allowed && recording && (!candidateTrack || candidateTrack.readyState === 'ended')) discard();
  }, [allowed, recording, discard, candidateTrack]);
  useEffect(() => {
    if (!recording || !candidateTrack) return;
    candidateTrack.addEventListener?.('ended', discard);
    return () => candidateTrack.removeEventListener?.('ended', discard);
  }, [recording, candidateTrack, discard]);

  if (!allowed) return null;

  function handleError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.code === 'SCORES_ALREADY_SAVED' || error.code === 'NO_RECORDING_CONSENT' || error.code === 'NOT_A_CALL') {
        setHidden(true);
        return;
      }
      if (error.code === 'FOLLOW_UP_LIMIT') return setNotice(text.limit);
      if (error.code === 'SPEECH_NOT_RECOGNISED') return setNotice(text.speech);
    }
    setNotice(text.unavailable);
  }

  function send(audio?: Blob, sample = false) {
    setNotice('');
    if (audio) setPendingAudio(audio);
    suggest.mutate({ audio, sample, question: question || undefined }, {
      onSuccess: (result) => {
        setLatest(result.followUpId);
        clip.discard();
        setPendingAudio(null);
      }, onError: handleError,
    });
  }

  async function finish() {
    const result = await clip.stop();
    if (!result.audio || result.seconds < 3) {
      clip.discard();
      setNotice(text.short);
      return;
    }
    if (!enabled || !room.otherAudio?.mediaStreamTrack) {
      clip.discard();
      return;
    }
    send(result.audio);
  }

  const items = followUps.data ?? [];
  const current = items.find((item) => item.followUpId === latest);
  const earlier = latest ? items.filter((item) => item.followUpId !== latest) : items;

  return (
    <section className="flex flex-col gap-3 border-b border-border-subtle pb-4" aria-label={text.title}>
      <h2 className="text-sm font-bold text-text-primary">{text.title}</h2>
      <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
        {text.answering}
        <select value={question} onChange={(event) => setQuestion(event.target.value)} disabled={clip.recording || suggest.isPending}
          className="min-w-0 rounded-control border border-border-strong bg-bg-surface px-2 py-2 text-sm text-text-primary">
          <option value="">{text.none}</option>
          {brief?.questions.map((item, index) => <option key={index} value={item.question}>{item.question}</option>)}
        </select>
      </label>
      {clip.recording ? (
        <button type="button" onClick={() => void finish()} className="rounded-control bg-brand-green px-3 py-2 text-sm font-semibold text-on-brand">
          {text.suggest} · {String(Math.floor(clip.seconds / 60)).padStart(2, '0')}:{String(clip.seconds % 60).padStart(2, '0')}
        </button>
      ) : recordedClip?.audio ? (
        <div className="flex gap-2">
          <button type="button" disabled={suggest.isPending || recordedClip.seconds < 3} onClick={() => send(recordedClip.audio!)}
            className="rounded-control bg-brand-green px-3 py-2 text-sm font-semibold text-on-brand disabled:opacity-50">{text.sendClip}</button>
          <button type="button" disabled={suggest.isPending} onClick={discard} className="px-2 text-sm text-text-secondary">{text.discard}</button>
        </div>
      ) : (
        <button type="button" disabled={suggest.isPending || !room.otherAudio?.mediaStreamTrack} onClick={() => {
          setNotice(''); setLatest(null); setPendingAudio(null);
          if (!clip.start(room.otherAudio?.mediaStreamTrack ?? null)) setNotice(text.unsupported);
        }} className="rounded-control bg-brand-green px-3 py-2 text-sm font-semibold text-on-brand disabled:opacity-50">
          {text.listen}
        </button>
      )}
      {clip.recording ? <p className="text-xs text-text-secondary">{text.recording} · 02:00 max</p> : null}
      {pendingAudio && suggest.isError ? <button type="button" onClick={() => send(pendingAudio)}
        className="w-fit text-xs font-semibold text-brand-ink underline">{text.retry}</button> : null}
      {/^(Candidate [ABC]|Кандидат [ABC])$/.test(candidateLabel) ? (
        <button type="button" disabled={suggest.isPending || clip.recording} onClick={() => { setLatest(null); setPendingAudio(null); send(undefined, true); }}
          className="w-fit text-xs font-semibold text-brand-ink underline-offset-2 hover:underline disabled:opacity-50">{text.sample}</button>
      ) : null}
      {suggest.isPending ? <p role="status" className="text-sm text-text-secondary">{text.thinking}</p> : null}
      {notice ? <p role="alert" className="text-sm text-status-low">{notice}</p> : null}
      {followUps.isError ? <p role="alert" className="text-sm text-status-low">{text.unavailable}</p> : null}
      {current && !current.suggestions.length ? <p className="text-sm text-text-secondary">{text.empty}</p> : null}
      {current ? <SuggestionList item={current} text={text} onMark={(suggestionId, status) => mark.mutate({ followUpId: current.followUpId, suggestionId, status }, { onError: handleError })} brief={brief} /> : null}
      {mark.isError && !hidden ? <p role="alert" className="text-sm text-status-low">{text.unavailable}</p> : null}
      {earlier.length ? <details className="text-sm"><summary className="cursor-pointer font-semibold text-text-secondary">{text.previous} ({earlier.length})</summary>
        <div className="mt-2 flex flex-col gap-3">{earlier.map((item) => <SuggestionList key={item.followUpId} item={item} text={text} brief={brief}
          onMark={(suggestionId, status) => mark.mutate({ followUpId: item.followUpId, suggestionId, status }, { onError: handleError })} />)}</div>
      </details> : null}
    </section>
  );
}

function SuggestionList({ item, text, brief, onMark }: {
  item: FollowUp; text: typeof copy.en; brief?: InterviewerBrief;
  onMark: (suggestionId: string, status: 'asked' | 'dismissed') => void;
}) {
  return <ul className="flex flex-col gap-2">{item.suggestions.map((suggestion: FollowUpSuggestion) => <li key={suggestion.suggestionId}
    className="flex flex-col gap-1.5 rounded-control border border-border-subtle bg-bg-surface p-3">
    <p lang="en" className="text-sm font-semibold text-text-primary">{suggestion.question}</p>
    <p className="text-xs font-medium text-text-secondary">{suggestion.competency} · {text.reasons[suggestion.reason]}</p>
    <p className="text-xs text-text-secondary">{text.why}: <span lang="en">{suggestion.why}</span></p>
    {suggestion.evidence.map((evidence, index) => <figure key={index} className="border-l-2 border-status-evidence pl-2">
      <blockquote className="text-sm text-text-primary">“{evidence.quote}”</blockquote>
      <figcaption className="text-xs text-text-muted">{evidence.source === 'follow_up_answer' ? text.quote : evidence.source === 'application_field'
        ? `${text.application} · ${brief?.application.find((field) => field.fieldId === evidence.sourceId)?.question ?? evidence.sourceId}`
        : `${text.test} · ${evidence.sourceId}`}</figcaption>
    </figure>)}
    {suggestion.status === 'open' ? <div className="flex gap-3 text-xs font-semibold text-brand-ink">
      <button type="button" onClick={() => onMark(suggestion.suggestionId, 'asked')}>{text.asked}</button>
      <button type="button" onClick={() => onMark(suggestion.suggestionId, 'dismissed')}>{text.dismiss}</button>
    </div> : <p className="text-xs text-text-muted">{suggestion.status === 'asked' ? text.asked : text.dismissed}</p>}
  </li>)}</ul>;
}
