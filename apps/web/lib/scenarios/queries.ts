'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../api/client';
import type { ScenarioSummary } from './types';

/** The pool as the API sees it. It changes only when a scenario passes the bench, so it is never refetched on its own. */
export function useScenarioPool() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: async () => unwrap(await api.GET('/v1/scenarios')) as unknown as ScenarioSummary[],
    staleTime: Infinity,
  });
}
