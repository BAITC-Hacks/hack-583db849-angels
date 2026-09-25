import type { Metadata } from 'next';
import { PresentationScreen } from '../../../../components/presentation/PresentationScreen';

export const metadata: Metadata = { title: 'Your presentation — AI Leader ID' };

/**
 * P: the video presentation that opens inVision's remote stage — one to three
 * minutes in English on a prompt everyone gets, recorded here or uploaded,
 * and sent once.
 *
 * English only, and nothing about a score or a decision, as everywhere a
 * candidate can go.
 */
export default function PresentationPage() {
  return (
    <div lang="en">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Your presentation</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">Tell us who you are, in your own words</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            A short video in English. There is no script to follow and no right answer — people want to hear you, not a
            polished speech.
          </p>
        </header>

        <PresentationScreen />
      </main>
    </div>
  );
}
