import type { Metadata } from 'next';
import { SurpriseFlow } from '../../../../../components/surprise/SurpriseFlow';
import { previewSurpriseStarted } from '../../../../../lib/surprise/preview';

export const metadata: Metadata = { title: 'A short question — AI Leader ID' };

/**
 * S: one unexpected question about the candidate's own application, answered
 * on camera in ninety seconds, once.
 *
 * Published questions can be rehearsed; this one cannot, which is the whole
 * reason it exists. The candidate screen is English only and shows no score,
 * no ranking and nothing about a decision — as everywhere they can see.
 *
 * Scripted until the surprise endpoints land (#55).
 */
export default async function SurprisePage({ params }: { params: Promise<{ surpriseId: string }> }) {
  const { surpriseId } = await params;
  void surpriseId;

  return (
    <div lang="en">
      <p className="border-b border-border-subtle bg-bg-elevated px-5 py-1.5 text-center font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
        Preview · a scripted question — the real one arrives with S
      </p>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">A short question</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">One question, ninety seconds</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            It is about something you wrote in your own application. Nobody expects a rehearsed answer — that is exactly
            why you have not seen the question before.
          </p>
        </header>

        <SurpriseFlow surprise={previewSurpriseStarted} />
      </main>
    </div>
  );
}
