import type { Metadata } from 'next';
import { AssessmentGate } from '../../../../components/home/AssessmentGate';

export const metadata: Metadata = { title: 'Simulation report — AI Leader ID' };

/** Candidate A's report, whatever its id: opens it once it is ready, and says where it is until then. */
export default function CurrentSimulationReportPage() {
  return <AssessmentGate audience="staff" />;
}
