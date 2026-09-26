import { findUserByEmail, MIDWAY_APPLICANT_EMAIL, READY_APPLICANT_EMAIL } from './db';
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
 * So `applicant.midway@example.test` arrives with three of the factual answers saved
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

  // `applicant.ready@example.test`: the whole form and all ten blocks, so the
  // hand-over to the AI layer can be shown with one click. Synthetic answers,
  // written for this account and unlike A, B and C's.
  const ready = findUserByEmail(READY_APPLICANT_EMAIL);
  if (!ready) return;
  const readyDraft = findDraftByApplicant(ready.id) ?? createDraft(ready.id);
  applyAnswerPatch(readyDraft, {
    current_education_status: 'secondary_school',
    intended_study_area: 'Applied mathematics',
    expected_graduation_year: 2027,
    city_region: 'Synthetic region',
    motivation:
      'I want to study where people build things for real users. At school I started a maths club, and I saw how much more we learned when we solved problems from our own town. inVision U is the place to learn that properly.',
    leadership_example:
      'Our class had two weeks to prepare a science fair. Nobody agreed on a topic, so I asked everyone to write one idea, we voted, and I split the work into three small teams with a deadline each. We finished a day early.',
    setback:
      'I organised a charity run, but only six people registered because I advertised it too late. I apologised to the sponsors, moved the run by a month and asked each runner to bring a friend. The second time forty people came.',
    community:
      'Many students in my town cannot find a quiet place to study after school. I would like to open the school library in the evenings with volunteers from the older classes.',
    english_self: 'B2',
    english_certificate: 'IELTS',
    english_certificate_score: '6.0',
  });
  if (!findAttemptByApplication(readyDraft.id)) {
    seedTerminalBlocks(createAttempt(readyDraft.id, ready.id), 10, 0);
  }
}
