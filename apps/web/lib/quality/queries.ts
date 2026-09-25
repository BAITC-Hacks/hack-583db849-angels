'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { api, unwrap } from '../api/client';
import { toQualityCheck } from '../api/mappers/quality';
import type { QualityCheck } from './types';

export const qualityChecksKey = ['quality-checks'] as const;

/** The latest checks, newest first. Nothing is overwritten, so the history is there too. */
export function useQualityChecks() {
  return useQuery({
    queryKey: qualityChecksKey,
    queryFn: async () => {
      const result = await api.GET('/v1/quality-checks', { params: { query: { limit: 20 } } });
      return unwrap(result).items.map(toQualityCheck);
    },
  });
}

/** The newest check of each kind, which is what the panel and the commission's home show. */
export function latestChecks(checks: QualityCheck[] | undefined) {
  return {
    interview: checks?.find((check) => check.kind === 'interview') ?? null,
    calibration: checks?.find((check) => check.kind === 'calibration') ?? null,
  };
}

export interface CalibrationInput {
  interviewerRef: string;
  from: string;
  to: string;
}

/** Runs a calibration. "Try again" after a failure sends the same `Idempotency-Key`. */
export function useRunCalibration() {
  const client = useQueryClient();
  const key = useRef<string | null>(null);
  return useMutation({
    mutationFn: async (input: CalibrationInput) => {
      key.current ??= crypto.randomUUID();
      const result = await api.POST('/v1/quality-checks/calibration', { body: input, headers: { 'Idempotency-Key': key.current } });
      return toQualityCheck(unwrap(result));
    },
    onSuccess: (check) => {
      key.current = null;
      client.setQueryData<QualityCheck[]>(qualityChecksKey, (checks) => [check, ...(checks ?? [])]);
    },
  });
}
