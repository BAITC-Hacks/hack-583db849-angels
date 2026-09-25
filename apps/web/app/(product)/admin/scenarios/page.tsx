import type { Metadata } from 'next';
import { ScenarioPoolLive } from '../../../../components/scenarios/ScenarioPoolLive';
import { getStaffLocale } from '../../../../lib/i18n/server';

export const metadata: Metadata = { title: 'Scenario pool — AI Leader ID' };

const copy = {
  en: {
    eyebrow: 'Scenario pool',
    title: 'What candidates can be given',
    lede: 'A scenario is assigned at random among the ready ones, the least used first, so answers cannot be learned from a friend who went before.',
    rule: 'A scenario becomes ready only by passing the quality bench: three reference walk-throughs scored within one point of what was expected, every quote verbatim. Until then it is never assigned.',
    hidden: 'The story, the character’s hidden motive and the branches stay inside the ML service. Nothing on this screen would help a candidate prepare.',
  },
  ru: {
    eyebrow: 'Пул сценариев',
    title: 'Что может выпасть кандидату',
    lede: 'Сценарий назначается случайно среди готовых, сначала наименее использованные, поэтому ответы нельзя подсмотреть у того, кто проходил раньше.',
    rule: 'Сценарий становится готовым, только пройдя стенд качества: три эталонных прохождения с баллами в пределах одного от ожидаемых и дословными цитатами. До этого он не выпадает никому.',
    hidden: 'Сюжет, скрытый мотив персонажа и ветки остаются внутри ML-сервиса. Ничто на этом экране не помогает кандидату подготовиться.',
  },
};

/**
 * M2b: the admin's view of the pool — which scenarios exist, which are ready
 * and how often each has come up.
 *
 * Even distribution is the point: a scenario that keeps winning the draw would
 * make its candidates comparable to each other and to nobody else.
 *
 * The pool comes from `GET /v1/scenarios`.
 */
export default async function ScenarioPoolPage() {
  const text = copy[await getStaffLocale()];

  return (
    <>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
          <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
          <p className="max-w-3xl border-l-2 border-border-strong pl-3 text-[0.8rem] text-text-secondary">{text.rule}</p>
        </header>

        <ScenarioPoolLive />

        <p className="max-w-3xl font-mono text-[0.68rem] text-text-muted">{text.hidden}</p>
      </main>
    </>
  );
}
