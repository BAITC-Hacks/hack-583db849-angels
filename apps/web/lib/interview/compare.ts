import type { Score } from '../../components/evidence/ScoreMeter';

export type Agreement = 'agree' | 'close' | 'discuss' | 'draft-found' | 'draft-none' | 'both-none';

/**
 * How the interviewer's score and the draft's relate. It describes, it does
 * not resolve: nothing here averages the two or picks a winner.
 */
export function compareScores(yours: Score, draft: Score): Agreement {
  if (yours === null && draft === null) return 'both-none';
  if (yours === null) return 'draft-found';
  if (draft === null) return 'draft-none';
  const gap = Math.abs(yours - draft);
  if (gap === 0) return 'agree';
  return gap === 1 ? 'close' : 'discuss';
}

/** Pairs that deserve a person's attention before anyone decides. */
export function needsReview(agreement: Agreement): boolean {
  return agreement === 'discuss' || agreement === 'draft-found' || agreement === 'draft-none';
}
