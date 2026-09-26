'use client';

import { useCandidates } from '../../lib/api/candidates';
import { candidateTag, seedCode } from '../../lib/api/mappers/evidence';
import { setDemoCandidate, useDemoCandidateId } from '../../lib/demo/currentCandidate';

/**
 * In the candidate role, whose screens these are: A (the pitch's), B, C, or
 * an applicant the stand sent. In production the platform signs the
 * applicant in and there is nothing to pick.
 */
export function CandidatePicker({ collapsed }: { collapsed: boolean }) {
  const candidates = useCandidates();
  const chosen = useDemoCandidateId();
  if (collapsed || !candidates.data || candidates.data.length === 0) return null;

  const a = candidates.data.find((candidate) => seedCode(candidate.label) === 'A');
  const value = chosen && candidates.data.some((candidate) => candidate.candidateId === chosen) ? chosen : (a?.candidateId ?? '');

  return (
    <label className="flex flex-col gap-1 px-1 text-[0.72rem] text-text-muted">
      Viewing as
      <select
        value={value}
        onChange={(event) => setDemoCandidate(event.target.value === a?.candidateId ? null : event.target.value)}
        className="rounded-control border border-border-strong bg-bg-surface px-2.5 py-1.5 text-sm text-text-primary"
      >
        {candidates.data.map((candidate) => (
          <option key={candidate.candidateId} value={candidate.candidateId}>
            Candidate {candidateTag(candidate.label)}
            {seedCode(candidate.label) ? '' : ' · from the stand'}
          </option>
        ))}
      </select>
    </label>
  );
}
