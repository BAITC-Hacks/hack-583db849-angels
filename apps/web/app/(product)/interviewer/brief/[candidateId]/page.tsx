import type { Metadata } from 'next';
import { BriefScreen } from '../../../../../components/brief/BriefScreen';

export const metadata: Metadata = { title: 'Interviewer brief — AI Leader ID' };

/** M1 for one candidate, from the API. */
export default async function BriefPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  return <BriefScreen candidateId={candidateId} />;
}
