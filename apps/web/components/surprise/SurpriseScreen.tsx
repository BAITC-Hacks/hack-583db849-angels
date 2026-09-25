'use client';

import Link from 'next/link';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useAnswerSurprise, useStartSurprise, useSurprise } from '../../lib/surprise/queries';
import { SurpriseFlow } from './SurpriseFlow';

/**
 * The candidate's surprise question, from the API through inVision's platform
 * key — which is sent the question only after `start`, and never what it
 * targets, the transcript or the video.
 */
export function SurpriseScreen({ surpriseId }: { surpriseId: string }) {
  const surprise = useSurprise(surpriseId);
  const start = useStartSurprise(surpriseId);
  const answer = useAnswerSurprise(surpriseId);

  if (surprise.isPending) {
    return (
      <p className="text-sm text-text-muted" aria-live="polite">
        Opening the question…
      </p>
    );
  }
  if (surprise.isError) {
    const missing = surprise.error instanceof ApiError && surprise.error.status === 404;
    return (
      <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5 text-sm">
        <h2 role="alert" className="font-semibold text-text-primary">
          {missing ? 'This question does not exist.' : errorText(surprise.error)}
        </h2>
        <Link href="/candidate" className="font-semibold text-brand-ink hover:underline">
          Back to your home
        </Link>
      </section>
    );
  }
  return <SurpriseFlow surprise={surprise.data} onStart={() => start.mutateAsync()} onSend={(input) => answer.mutateAsync(input)} />;
}
