import type { Metadata } from 'next';
import { InterviewerSchedule } from '../../../../components/schedule/InterviewerSchedule';

export const metadata: Metadata = { title: 'Schedule — AI Leader ID' };

/** V: the times the interviewer offers for the video interview, and who booked them. */
export default function SchedulePage() {
  return <InterviewerSchedule />;
}
