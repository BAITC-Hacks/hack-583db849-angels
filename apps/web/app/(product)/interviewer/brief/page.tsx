import type { Metadata } from 'next';
import { BriefList } from '../../../../components/brief/BriefList';

export const metadata: Metadata = { title: 'Briefs — AI Leader ID' };

/** Every candidate's brief, from the API. */
export default function BriefsPage() {
  return <BriefList />;
}
