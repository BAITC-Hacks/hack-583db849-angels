import type { Metadata } from 'next';
import { ConsistencyComparison } from '../../../../../components/consistency/ConsistencyComparison';
import { ConsistencyGate } from '../../../../../components/consistency/ConsistencyGate';
import { getConsistency } from '../../../../../lib/consistency/preview';
import { getStaffLocale } from '../../../../../lib/i18n/server';

export const metadata: Metadata = { title: 'Consistency — AI Leader ID' };

const copy = {
  en: {
    preview: 'Preview · a scripted comparison — the real one arrives with C',
    eyebrow: 'Consistency',
    candidate: 'Candidate',
    lede: 'What the candidate said about themselves, against what was measured and what the interview showed. Signals with their evidence — no score is given here, and no decision is made here.',
    privacy: 'Built from answers, speech measures and the interview transcript. Quotes are never translated.',
  },
  ru: {
    preview: 'Превью · заготовленная сверка — настоящая появится в слайсе C',
    eyebrow: 'Сверка данных',
    candidate: 'Кандидат',
    lede: 'Что кандидат сказал о себе — против того, что измерено и что показало интервью. Сигналы с доказательствами: баллов здесь нет и решение здесь не принимается.',
    privacy: 'Собрано из ответов, метрик речи и расшифровки интервью. Цитаты не переводятся.',
  },
};

/**
 * C: the commission's side of the consistency layer. The brief showed the
 * before stage to the interviewer; this shows both stages together, so the
 * panel can see what the interview settled and what it left open.
 *
 * Scripted until the consistency endpoint lands (#51).
 */
export default async function ConsistencyPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const text = copy[await getStaffLocale()];
  const before = getConsistency(candidateId, 'before');
  const after = getConsistency(candidateId, 'after');

  return (
    <ConsistencyGate>
      <p className="border-b border-border-subtle bg-bg-elevated px-5 py-1.5 text-center font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
        {text.preview}
      </p>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">
            {text.candidate} A
          </h1>
          <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
          <p className="max-w-3xl font-mono text-[0.68rem] text-text-muted">{text.privacy}</p>
        </header>

        <ConsistencyComparison before={before} after={after} />
      </main>
    </ConsistencyGate>
  );
}
