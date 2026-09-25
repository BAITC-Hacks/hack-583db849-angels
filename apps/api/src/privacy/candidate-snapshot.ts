import type { Prisma } from '@prisma/client';

import type { CandidateSnapshot } from './to-llm-view.service';

/** The stored columns a snapshot is made of. */
export const snapshotSelect = {
  externalId: true, profile: true, application: true, test: true, englishCertificate: true,
} as const satisfies Prisma.CandidateSelect;

export type SnapshotRow = Prisma.CandidateGetPayload<{ select: typeof snapshotSelect }>;

/** A stored candidate in the shape `toLlmView` reads — the only way a candidate goes towards a model. */
export function candidateSnapshot(candidate: SnapshotRow): CandidateSnapshot {
  return {
    externalId: candidate.externalId,
    profile: candidate.profile as Record<string, unknown>,
    application: candidate.application as unknown as CandidateSnapshot['application'],
    test: candidate.test as unknown as CandidateSnapshot['test'],
    ...(candidate.englishCertificate ? { englishCertificate: candidate.englishCertificate as unknown as CandidateSnapshot['englishCertificate'] } : {}),
  };
}
