import type { Metadata } from 'next';
import { QualityGuardScreen } from '../../../../components/quality/QualityGuardScreen';

export const metadata: Metadata = { title: 'Quality guard — AI Leader ID' };

/** M5 for the commission, from the API. */
export default function QualityGuardPage() {
  return <QualityGuardScreen />;
}
