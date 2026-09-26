'use client';

import { useMe } from '../../lib/api/candidates';
import { errorText } from '../../lib/api/errors';
import { useSubmitPresentation } from '../../lib/presentation/queries';
import { PresentationFlow } from './PresentationFlow';

/**
 * Loads the demo's candidate and whether they have already sent a
 * presentation, then hands over to the flow. The candidate's channel never
 * reads the transcript: it only learns that the presentation arrived.
 */
export function PresentationScreen() {
  const { candidates, me } = useMe();
  const submit = useSubmitPresentation();

  if (candidates.isError) {
    return (
      <p role="alert" className="text-sm font-semibold text-text-primary">
        {errorText(candidates.error)}
      </p>
    );
  }
  if (!me) return <p className="text-sm text-text-secondary">Loading…</p>;

  return <PresentationFlow candidateId={me.candidateId} alreadySent={Boolean(me.progress?.presentation)} onSend={submit.mutateAsync} />;
}
