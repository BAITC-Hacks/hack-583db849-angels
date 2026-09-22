'use client';

import { competencies } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { StaffLocale } from '../../lib/i18n/staffLocale';
import { compareScores, needsReview, type Agreement } from '../../lib/interview/compare';
import type { AssessmentDraft, InterviewerScores } from '../../lib/interview/types';
import { EvidenceQuote } from '../evidence/EvidenceQuote';
import { ScoreMeter } from '../evidence/ScoreMeter';

const agreementText: Record<StaffLocale, Record<Agreement, string>> = {
  en: {
    agree: 'Same',
    close: 'One point apart',
    discuss: 'Discuss before deciding',
    'draft-found': 'You saw too little; the draft found evidence — check it',
    'draft-none': 'The draft found no verified evidence; your score rests on your judgement',
    'both-none': 'Neither of you had enough to judge',
  },
  ru: {
    agree: 'Совпадает',
    close: 'Разница в один балл',
    discuss: 'Обсудить до решения',
    'draft-found': 'Вам не хватило данных, а черновик нашёл доказательства — проверьте их',
    'draft-none': 'Черновик не нашёл проверенных доказательств; ваш балл опирается на ваше суждение',
    'both-none': 'Ни вам, ни черновику не хватило данных',
  },
};

const agreementTone: Record<Agreement, string> = {
  agree: 'border-brand-ink/30 bg-brand-soft text-brand-ink',
  close: 'border-border-subtle bg-bg-elevated text-text-secondary',
  discuss: 'border-status-flag/40 bg-chip-flag/30 text-status-flag',
  'draft-found': 'border-status-evidence/40 bg-chip-review text-status-evidence',
  'draft-none': 'border-status-evidence/40 bg-chip-review text-status-evidence',
  'both-none': 'border-border-subtle bg-bg-elevated text-text-muted',
};

const copy = {
  en: {
    you: 'You',
    draft: 'Draft',
    review: 'For manual review',
    none: 'No large differences. The decision is still yours.',
  },
  ru: {
    you: 'Вы',
    draft: 'Черновик',
    review: 'Проверить вручную',
    none: 'Больших расхождений нет. Решение всё равно за вами.',
  },
};

/**
 * The interviewer's scores beside the draft's, competency by competency, with
 * the candidate's own words from the transcript. It points at differences and resolves
 * none: no average, no merged score, no suggestion to change.
 */
export function DraftComparison({ yours, draft }: { yours: InterviewerScores; draft: AssessmentDraft }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  const rows = draft.scores.map((item) => {
    const drafted = item.score !== null && item.evidence.length > 0 ? item.score : null;
    const own = yours[item.competency] ?? null;
    return { item, own, drafted, agreement: compareScores(own, drafted) };
  });
  const review = rows.filter((row) => needsReview(row.agreement));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-panel border border-border-subtle bg-bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">{text.review}</h3>
        {review.length === 0 ? (
          <p className="mt-1 text-sm text-text-secondary">{text.none}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {review.map((row) => (
              <li key={row.item.competency} className="flex items-start gap-2 text-sm text-text-secondary">
                <a href={`#draft-${row.item.competency}`} className="font-mono font-bold text-text-primary hover:underline">
                  {row.item.competency}
                </a>
                <span>{agreementText[locale][row.agreement]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.map(({ item, own, drafted, agreement }) => (
        <article
          key={item.competency}
          id={`draft-${item.competency}`}
          className="@container flex scroll-mt-6 flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5"
        >
          <header className="flex flex-col gap-2 @lg:flex-row @lg:items-start @lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-bg-elevated font-mono text-sm font-bold text-text-primary">
                {item.competency}
              </span>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">{competencies[item.competency].name}</h4>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${agreementTone[agreement]}`}>
                  {agreementText[locale][agreement]}
                </span>
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
              <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{text.you}</dt>
              <dd>
                <ScoreMeter score={own} />
              </dd>
              <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{text.draft}</dt>
              <dd>
                <ScoreMeter score={drafted} confidence={drafted === null ? undefined : item.confidence} />
              </dd>
            </dl>
          </header>

          {drafted !== null ? (
            <>
              {item.rationale ? <p className="text-sm text-text-secondary">{item.rationale}</p> : null}
              <div className="flex flex-col gap-3">
                {item.evidence.map((evidence) => (
                  <EvidenceQuote key={evidence.quote} {...evidence} href={`#${evidence.source.id}`} />
                ))}
              </div>
            </>
          ) : null}
        </article>
      ))}
    </div>
  );
}
