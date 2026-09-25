import type { Metadata } from 'next';
import { SurpriseScreen } from '../../../../../components/surprise/SurpriseScreen';

export const metadata: Metadata = { title: 'A short question — AI Leader ID' };

/**
 * S: one unexpected question about the candidate's own application, answered
 * on camera in ninety seconds, once.
 *
 * Published questions can be rehearsed; this one cannot, which is the whole
 * reason it exists. The candidate screen is English only and shows no score,
 * no ranking and nothing about a decision — as everywhere they can see.
 */
export default async function SurprisePage({ params }: { params: Promise<{ surpriseId: string }> }) {
  const { surpriseId } = await params;

  return (
    <div lang="en">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">A short question</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">One question, ninety seconds</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            It is about something you wrote in your own application. Nobody expects a rehearsed answer — that is exactly
            why you have not seen the question before.
          </p>
        </header>

        <SurpriseScreen surpriseId={surpriseId} />
      </main>
    </div>
  );
}
