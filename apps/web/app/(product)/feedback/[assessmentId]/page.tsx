import type { Metadata } from 'next';
import { AssessmentGate } from '../../../../components/home/AssessmentGate';
import { FeedbackView } from '../../../../components/report/FeedbackView';
import { getFeedback } from '../../../../lib/report/preview';

export const metadata: Metadata = { title: 'Your simulation feedback' };

/**
 * What the candidate receives after the simulation, relayed through inVision.
 * Candidate screens are English only; this one carries no score of any kind.
 */
export default async function CandidateFeedbackPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const feedback = getFeedback(assessmentId);

  return (
    <AssessmentGate audience="candidate">
      <div lang="en">
        <p className="border-b border-border-subtle bg-bg-elevated px-5 py-1.5 text-center font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
          Preview · scripted feedback — the real one arrives with M3
        </p>
        <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
          <header className="flex flex-col gap-2">
            <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Your feedback</p>
            <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">What stood out in your simulation</h1>
            <p className="text-sm text-text-secondary">
              Scenario: {feedback.scenarioTitle}. These notes are about how you led the conversation — not about your
              English.
            </p>
          </header>
          <FeedbackView feedback={feedback} />
        </main>
      </div>
    </AssessmentGate>
  );
}
