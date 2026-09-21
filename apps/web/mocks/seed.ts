import { findUserByEmail, MIDWAY_APPLICANT_EMAIL } from './db';
import { applyAnswerPatch, createDraft, findDraftByApplicant } from './s2';
import { createAttempt, findAttemptByApplication, seedTerminalBlocks } from './s3';

/**
 * Puts one of the two synthetic applicants halfway through the journey.
 *
 * Without it every demonstration starts from nothing: an empty cabinet, a rail
 * that has not moved, a ledger of zeroes. That is a fair view of a first visit
 * and a poor view of the product, and answering ten timed blocks by hand before
 * each showing is not a reasonable price for a screenshot.
 *
 * So `applicant.midway@example.test` arrives with three of four answers saved
 * and four blocks behind them — three answered, one that ran out of time,
 * because the state worth seeing is the one where something went wrong and was
 * recorded honestly. `applicant.demo@example.test` is left untouched, so the
 * first-run path stays demonstrable too.
 *
 * All of it lives in tab memory, like every other mock. Nothing is written to
 * browser storage, and a reload starts this world again from the beginning.
 */
export function seedDemoJourney(): void {
  const midway = findUserByEmail(MIDWAY_APPLICANT_EMAIL);
  if (!midway) return;

  const draft = findDraftByApplicant(midway.id) ?? createDraft(midway.id);
  applyAnswerPatch(draft, {
    current_education_status: 'secondary_school',
    intended_study_area: 'Computer science and product design',
    expected_graduation_year: 2027,
  });

  if (!findAttemptByApplication(draft.id)) {
    seedTerminalBlocks(createAttempt(draft.id, midway.id), 3, 1);
  }
}
