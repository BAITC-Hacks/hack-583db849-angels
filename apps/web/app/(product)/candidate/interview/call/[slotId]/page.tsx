import type { Metadata } from 'next';
import { CandidateCall } from '../../../../../../components/call/CandidateCall';

export const metadata: Metadata = { title: 'Your interview — AI Leader ID' };

/** V: the candidate in the call. English only. */
export default async function CandidateCallPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  return (
    <div lang="en">
      <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-8">
        <header className="flex flex-col gap-1.5">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Your interview</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">Video interview</h1>
        </header>
        <CandidateCall slotId={slotId} />
      </main>
    </div>
  );
}
