import type { Metadata } from 'next';
import { ReportScreen } from '../../../../../components/report/ReportScreen';

export const metadata: Metadata = { title: 'Simulation report — AI Leader ID' };

/** M3 for the commission, for one assessment, from the API. */
export default async function SimulationReportPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  return <ReportScreen assessmentId={assessmentId} />;
}
