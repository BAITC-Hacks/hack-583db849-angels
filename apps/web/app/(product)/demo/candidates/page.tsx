import type { Metadata } from 'next';
import { DemoOverview } from '../../../../components/demo/DemoOverview';

export const metadata: Metadata = { title: 'Choose a candidate — AI Leader ID' };

/** Where the demo starts, from the API. */
export default function DemoCandidatesPage() {
  return <DemoOverview />;
}
