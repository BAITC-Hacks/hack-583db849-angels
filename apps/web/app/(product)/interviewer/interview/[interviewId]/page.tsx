'use client';

import { useParams } from 'next/navigation';
import { InterviewScreen } from '../../../../../components/interview/InterviewScreen';
import { useInterview } from '../../../../../lib/interview/useInterview';

/** M4 for the interviewer: their own scores first, then the draft and the differences. */
export default function InterviewPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  return <InterviewScreen state={useInterview(interviewId)} />;
}
