import type { Metadata } from 'next';
import { ConsistencyScreen } from '../../../../../components/consistency/ConsistencyScreen';

export const metadata: Metadata = { title: 'Consistency — AI Leader ID' };

/** C for the commission, from the API: both stages side by side. */
export default async function ConsistencyPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  return <ConsistencyScreen candidateId={candidateId} />;
}
