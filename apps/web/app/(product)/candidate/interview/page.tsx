import type { Metadata } from 'next';
import { CandidateInterview } from '../../../../components/schedule/CandidateInterview';

export const metadata: Metadata = { title: 'Your interview — AI Leader ID' };

/**
 * V: the candidate books the live video interview. English only, and nothing
 * about a score or a decision, as everywhere a candidate can go.
 */
export default function CandidateInterviewPage() {
  return (
    <div lang="en">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Your interview</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">A conversation with the admissions team</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            A live video call in English with one interviewer. Choose a time that suits you. People make every decision about
            your application.
          </p>
        </header>
        <CandidateInterview />
      </main>
    </div>
  );
}
