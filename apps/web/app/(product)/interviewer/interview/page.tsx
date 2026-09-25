import type { Metadata } from 'next';
import { InterviewList } from '../../../../components/interview/InterviewList';

export const metadata: Metadata = { title: 'Interviews — AI Leader ID' };

/** Every candidate's interview, from the API. */
export default function InterviewsPage() {
  return <InterviewList />;
}
