'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '../../../lib/api/candidates';
import { errorText } from '../../../lib/api/errors';

/**
 * "My simulation": opens the candidate's own simulation, whatever its id. With
 * none started yet, the home is where it starts, so that is where this goes.
 */
export default function MySimulation() {
  const router = useRouter();
  const { candidates, me } = useMe();
  const simulationId = me?.progress?.simulation?.simulationId ?? null;

  useEffect(() => {
    if (candidates.isSuccess) router.replace(simulationId ? `/simulation/${simulationId}` : '/candidate');
  }, [candidates.isSuccess, simulationId, router]);

  return (
    <main lang="en" className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5">
      <p className="text-sm text-text-muted" aria-live="polite">
        {candidates.isError ? errorText(candidates.error) : 'Opening your simulation…'}
      </p>
    </main>
  );
}
