import type { Metadata } from 'next';
import { InterviewLoader } from '../../../../../components/interview/InterviewLoader';

export const metadata: Metadata = { title: 'Interview — AI Leader ID' };

/** M4 for the interviewer, from the API: their own scores first, then the draft and the differences. */
export default async function InterviewPage({ params }: { params: Promise<{ interviewId: string }> }) {
  const { interviewId } = await params;
  return <InterviewLoader interviewId={interviewId} />;
}
