'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../api/client';
import type { WireAssessment, WireCandidateFeedback } from '../api/contract';
import { toCandidateFeedback, toSimulationReport } from '../api/mappers/assessment';

/** The commission report, read once it is ready: the API answers 404 before that. */
export function useAssessment(assessmentId: string) {
  return useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: async () => {
      const result = await api.GET('/v1/simulation-assessments/{assessmentId}', { params: { path: { assessmentId } } });
      return toSimulationReport(unwrap(result) as unknown as WireAssessment);
    },
  });
}

/** What the candidate reads. Every role may open it, and it never carries a score. */
export function useFeedback(assessmentId: string) {
  return useQuery({
    queryKey: ['feedback', assessmentId],
    queryFn: async () => {
      const result = await api.GET('/v1/simulation-assessments/{assessmentId}/candidate-feedback', {
        params: { path: { assessmentId } },
      });
      return toCandidateFeedback(unwrap(result) as unknown as WireCandidateFeedback);
    },
  });
}
