import type { Metadata } from 'next';
import { FeedbackScreen } from '../../../../components/report/ReportScreen';

export const metadata: Metadata = { title: 'Your simulation feedback' };

/**
 * What the candidate receives after the simulation, relayed through inVision.
 * Candidate screens are English only; this one carries no score of any kind.
 */
export default async function CandidateFeedbackPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  return <FeedbackScreen assessmentId={assessmentId} />;
}
