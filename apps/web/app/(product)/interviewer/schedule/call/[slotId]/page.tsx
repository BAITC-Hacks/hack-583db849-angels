import type { Metadata } from 'next';
import { InterviewerCall } from '../../../../../../components/call/InterviewerCall';

export const metadata: Metadata = { title: 'Video interview — AI Leader ID' };

/** V: the interviewer in the call, with the brief's questions, notes and blind scores beside it. */
export default async function InterviewerCallPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  return <InterviewerCall slotId={slotId} />;
}
