import type { Metadata } from 'next';
import { DemoHeader } from '../../../components/demo/DemoHeader';
import { CompetencyScore, type CompetencyScoreProps } from '../../../components/evidence/CompetencyScore';
import { EnglishMetricsPanel } from '../../../components/evidence/EnglishMetricsPanel';
import { ScoreMeter } from '../../../components/evidence/ScoreMeter';

export const metadata: Metadata = { title: 'Evidence components — AI Leader ID' };

/**
 * Reference page for the pieces the report, brief and interview screens are
 * built from, in every state they can be in. Synthetic data; not linked from
 * the demo.
 */
const sample: CompetencyScoreProps[] = [
  {
    competency: 'D',
    score: 2,
    confidence: 'medium',
    rationale: 'Names a recovery step after the plan breaks, but does not follow it through.',
    evidence: [{ quote: 'Let’s just push the login fix to tomorrow and see.', source: { kind: 'simulation_turn', id: 'turn_06' } }],
  },
  { competency: 'R', score: null, evidence: [] },
  {
    competency: 'I',
    score: 3,
    confidence: 'high',
    rationale: 'Separates the code dispute from the trust problem behind it.',
    evidence: [
      {
        quote: 'I don’t think this is about whose version is better. It’s about nobody asking you first.',
        source: { kind: 'simulation_turn', id: 'turn_04' },
      },
    ],
  },
  { competency: 'V', score: null, evidence: [] },
  {
    competency: 'E',
    score: 3,
    confidence: 'high',
    rationale: 'Turns the conflict into owners and a deadline without being asked.',
    evidence: [
      {
        quote: 'You keep the auth module, Timur takes the UI, and we freeze the backend by Thursday noon.',
        source: { kind: 'simulation_turn', id: 'turn_08' },
      },
      {
        quote: 'I organised a weekend clean-up with twelve volunteers and split them into three teams.',
        source: { kind: 'application_field', id: 'leadership_example' },
      },
    ],
  },
];

export default function EvidenceKitPage() {
  return (
    <>
      <DemoHeader />

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10">
        <section className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Reference</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">Evidence components</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            What the report, the brief and the interview draft are built from. Every score carries its quotes; a
            competency without verified evidence says so instead of showing a low number. Synthetic data.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Scale</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
            {([0, 1, 2, 3, 4, null] as const).map((score) => (
              <ScoreMeter key={String(score)} score={score} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-3">
            <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">D.R.I.V.E.</h2>
            {sample.map((item) => (
              <CompetencyScore key={item.competency} {...item} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Separately</h2>
            <EnglishMetricsPanel
              metrics={{
                cefrEstimate: 'B2',
                wordsPerMinute: 118,
                meanTurnLength: 31.5,
                lexicalDiversity: 0.62,
                fillerRate: 0.04,
                grammarErrorsPer100Words: 2.1,
              }}
            />

            <h2 className="mt-4 font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
              A score sent without evidence
            </h2>
            <CompetencyScore competency="R" score={4} confidence="high" evidence={[]} />
          </div>
        </section>
      </main>
    </>
  );
}
