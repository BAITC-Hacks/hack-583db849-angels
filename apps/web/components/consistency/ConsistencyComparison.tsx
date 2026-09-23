'use client';

import { ArrowLongRightIcon } from '@heroicons/react/24/outline';
import { statusWords, topicWords } from '../../lib/consistency/labels';
import type { ConsistencyItem, ConsistencyReport } from '../../lib/consistency/types';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { EvidenceQuote } from '../evidence/EvidenceQuote';

const copy = {
  en: {
    claim: 'The candidate says',
    before: 'Before the interview',
    after: 'After the interview',
    whatToDo: 'What to do',
    asked: 'The brief suggested asking',
    notAsked: 'This was not settled in the interview.',
    newItem: 'New after the interview',
  },
  ru: {
    claim: 'Кандидат говорит',
    before: 'До интервью',
    after: 'После интервью',
    whatToDo: 'Что сделать',
    asked: 'Бриф предлагал спросить',
    notAsked: 'На интервью это не выяснили.',
    newItem: 'Появилось после интервью',
  },
};

function Side({ title, item }: { title: string; item: ConsistencyItem | null }) {
  const { locale } = useStaffLocale();

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{title}</p>
      {item ? (
        <>
          <span
            className={`w-fit rounded-control px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.1em] uppercase ${
              item.status === 'discrepancy' ? 'bg-status-flag/15 text-text-primary' : 'bg-bg-elevated text-text-muted'
            }`}
          >
            {statusWords[locale][item.status]}
          </span>
          <p className="text-sm text-text-primary">{item.observation.text}</p>
          {item.observation.metric ? (
            <p className="w-fit rounded-control bg-bg-elevated px-2.5 py-1 font-mono text-[0.68rem] text-text-secondary">
              {item.observation.metric.name}: {item.observation.metric.value} · {item.observation.metric.source}
            </p>
          ) : null}
          {item.observation.evidence.map((evidence) => (
            <EvidenceQuote key={evidence.quote} quote={evidence.quote} source={evidence.source} />
          ))}
        </>
      ) : (
        <p className="text-sm text-text-muted">—</p>
      )}
    </div>
  );
}

/**
 * What the candidate claimed, what was measured before the interview, and what
 * the interview itself showed — side by side, so the commission reads one
 * story instead of two reports.
 *
 * An item nobody asked about stays open and says so. That is the honest
 * outcome, and it is more useful to a panel than a tidy one.
 */
export function ConsistencyComparison({ before, after }: { before: ConsistencyReport; after: ConsistencyReport }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const beforeById = new Map(before.items.map((item) => [item.itemId, item]));
  const itemIds = [...new Set([...before.items.map((item) => item.itemId), ...after.items.map((item) => item.itemId)])];
  const afterById = new Map(after.items.map((item) => [item.itemId, item]));

  return (
    <section aria-labelledby="comparison-title" className="flex flex-col gap-3">
      <h2 id="comparison-title" className="sr-only">
        {text.after}
      </h2>

      {itemIds.map((itemId) => {
        const earlier = beforeById.get(itemId) ?? null;
        const later = afterById.get(itemId) ?? null;
        const current = later ?? earlier;
        if (!current) return null;
        const openAfter = later?.status === 'discrepancy' || later?.status === 'unverified';

        return (
          <article
            key={itemId}
            className={`flex flex-col gap-4 rounded-panel border bg-bg-surface p-5 ${
              openAfter ? 'border-status-flag/35' : 'border-border-subtle'
            }`}
          >
            <header className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{topicWords[locale][current.topic]}</h3>
              {earlier ? null : (
                <span className="rounded-control bg-bg-elevated px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">
                  {text.newItem}
                </span>
              )}
            </header>

            <div className="flex flex-col gap-2">
              <p className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.claim}</p>
              <p className="text-sm text-text-primary">{current.claim.text}</p>
              {current.claim.evidence.map((evidence) => (
                <EvidenceQuote key={evidence.quote} quote={evidence.quote} source={evidence.source} />
              ))}
            </div>

            <div className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
              <Side title={text.before} item={earlier} />
              <ArrowLongRightIcon aria-hidden="true" className="hidden h-5 w-5 self-center text-text-muted md:block" />
              <Side title={text.after} item={later} />
            </div>

            {later?.status === 'unverified' && earlier?.askInInterview ? (
              <p className="rounded-control border-l-2 border-status-flag bg-bg-elevated px-3 py-2 text-sm text-text-primary">
                <span className="font-semibold">{text.notAsked}</span> {text.asked}: “{earlier.askInInterview}”
              </p>
            ) : null}

            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">{text.whatToDo}:</span> {(later ?? earlier)?.whatToDo}
            </p>
          </article>
        );
      })}
    </section>
  );
}
