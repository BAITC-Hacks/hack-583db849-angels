import type { Metadata } from 'next';
import { AssessmentGate } from '../../../components/home/AssessmentGate';

export const metadata: Metadata = { title: 'Your simulation feedback' };

/** "My feedback": opens the candidate's own feedback once it is ready. */
export default function MyFeedbackPage() {
  return <AssessmentGate audience="candidate" />;
}
