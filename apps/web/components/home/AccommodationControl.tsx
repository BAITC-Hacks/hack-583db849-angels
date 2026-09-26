'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { candidateByCode, candidatesKey, useCandidates } from '../../lib/api/candidates';
import { api, unwrap } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import type { WireCandidate } from '../../lib/api/contract';
import { candidateTag, seedCode } from '../../lib/api/mappers/evidence';
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
    unavailable: 'Not reachable right now.',
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
    unavailable: 'Сейчас недоступно.',
  },
};

/**
 * The accommodation, in the hands of staff rather than the candidate. The
 * server holds the rules — a reason is required, and nothing changes once the
 * simulation has started (`409 SIMULATION_STARTED`) — and its answer is what
 * the row shows.
 */
export function AccommodationControl() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  // Keyed by the seed's letter, or a platform applicant's id.
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const client = useQueryClient();
  const candidates = useCandidates();
  const change = useMutation({
    mutationFn: async ({ candidateId, textMode, reason }: { key: string; candidateId: string; textMode: boolean; reason: string }) =>
      unwrap(
        await api.PUT('/v1/candidates/{candidateId}/accommodations', {
          params: { path: { candidateId } },
          body: { textMode, reason },
        }),
      ),
    onSuccess: (saved, { candidateId }) => {
      // Show the server's answer at once; the refetch that follows says the same.
      client.setQueryData<WireCandidate[]>(candidatesKey, (items) =>
        items?.map((item) =>
          item.candidateId === candidateId && item.progress
            ? { ...item, progress: { ...item.progress, accommodation: { textMode: saved.textMode, reason: saved.reason } } }
            : item,
        ),
      );
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
  const set = (key: string, candidateId: string | undefined, textMode: boolean, reason: string) => {
    if (candidateId) change.mutate({ key, candidateId, textMode, reason });
  };
  // A, B and C always have a row; then every applicant the platform sent.
  const rows = [
    ...(['A', 'B', 'C'] as const).map((code) => ({ key: code, tag: code, candidate: candidateByCode(candidates.data, code) })),
    ...(candidates.data ?? [])
      .filter((candidate) => seedCode(candidate.label) === null)
      .map((candidate) => ({ key: candidate.candidateId, tag: candidateTag(candidate.label), candidate })),
  ];

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-text-primary">{text.title}</h2>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </div>

      <ul className="flex flex-col divide-y divide-border-subtle">
        {rows.map(({ key: code, tag, candidate }) => {
          const accommodation = candidate?.progress?.accommodation ?? { textMode: false, reason: '' };
          const started = Boolean(candidate?.progress?.simulation);
          const reason = reasons[code] ?? accommodation.reason;
          const failed = change.isError && change.variables?.key === code ? errorText(change.error, locale) : null;
          const unavailable = candidates.isError || (candidates.isSuccess && !candidate);

          return (
            <li key={code} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-28 font-semibold text-text-primary">
                {text.candidate} {tag}
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
                    disabled={started || unavailable || change.isPending}
                    onClick={() => set(code, candidate?.candidateId, false, accommodation.reason || 'Back to speaking')}
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
                    disabled={started || unavailable || change.isPending || reason.trim().length === 0}
                    onClick={() => set(code, candidate?.candidateId, true, reason.trim())}
                    className="rounded-control border border-border-strong px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {text.switchOn}
                  </button>
                </>
              )}

              {started ? <span className="w-full text-[0.72rem] text-text-muted">{text.started}</span> : null}
              {unavailable ? <span className="w-full text-[0.72rem] text-text-muted">{text.unavailable}</span> : null}
              {failed ? (
                <span role="alert" className="w-full text-[0.72rem] text-text-primary">
                  {failed}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
