'use client';

import { api, unwrap } from '../api/client';
import { setDemoCandidate } from '../demo/currentCandidate';
import { DEMO_ROLE_COOKIE } from '../roles';
import { markSubmitted, platformSnapshot } from '../../mocks/platformExport';

function actAsCandidate(): void {
  // The candidate role is what the BFF sends under inVision's platform key.
  document.cookie = `${DEMO_ROLE_COOKIE}=candidate; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The platform's hand-over: the applicant's snapshot to `POST /v1/candidates`,
 * under the platform key, once. The API keeps the profile, strips it before
 * any model and starts the brief. Returns the candidate's id in the AI layer.
 */
export async function sendApplication(applicantId: string, idempotencyKey: string): Promise<string> {
  const snapshot = platformSnapshot(applicantId);
  if (!snapshot) throw new Error('There is no application to send.');
  actAsCandidate();
  const candidate = unwrap(
    await api.POST('/v1/candidates', { body: snapshot, headers: { 'Idempotency-Key': idempotencyKey } }),
  ) as unknown as { candidateId: string };
  markSubmitted(applicantId, candidate.candidateId);
  return candidate.candidateId;
}

/** The applicant carries on in the AI layer as themselves: its candidate screens, as this candidate. */
export function continueAs(candidateId: string): void {
  actAsCandidate();
  setDemoCandidate(candidateId);
}
