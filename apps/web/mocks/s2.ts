import type { ActiveCycle, ApplicationDraft, DraftAnswers, FormVersion } from '@invision/stand-client';

/**
 * The approved synthetic seed, exactly as docs/slices/s2-versioned-application-
 * draft-specification.md section 9 and 17 define it: the same cycle and form
 * version identifiers, the same four optional factual questions, and nothing
 * else. No motivation or competency prompt belongs in S2 — those are S3 and S4.
 *
 * Everything here lives in memory for the lifetime of the tab. Applicant
 * answers never reach browser storage.
 */
export const CYCLE_ID = '11111111-1111-4111-8111-111111111111';
export const FORM_VERSION_ID = '22222222-2222-4222-8222-222222222222';

export const formVersion: FormVersion = {
  id: FORM_VERSION_ID,
  version: 1,
  title: 'Synthetic applicant profile',
  description: 'Synthetic, non-scoring factual demo form; not official admissions methodology.',
  publishedAt: '2026-09-17T12:00:00Z',
  questions: [
    {
      id: 'current_education_status',
      label: 'Current education status',
      type: 'SINGLE_SELECT',
      required: false,
      options: [
        { value: 'secondary_school', label: 'Secondary school' },
        { value: 'technical_vocational', label: 'Technical or vocational college' },
        { value: 'undergraduate', label: 'Undergraduate programme' },
        { value: 'graduate', label: 'Graduate programme' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      id: 'intended_study_area',
      label: 'Intended study area or specialty',
      type: 'TEXT',
      required: false,
      constraints: { maxLength: 160 },
    },
    {
      id: 'expected_graduation_year',
      label: 'Expected graduation year',
      type: 'NUMBER',
      required: false,
      constraints: { minimum: 1900, maximum: 2100 },
    },
    {
      id: 'city_region',
      label: 'Current city or region',
      helpText: 'Reference information only; it is not used for scoring.',
      type: 'TEXT',
      required: false,
      constraints: { maxLength: 160 },
    },
  ],
};

export const activeCycle: ActiveCycle = {
  id: CYCLE_ID,
  name: 'Synthetic pitch cycle',
  formVersion,
};

interface MockDraft {
  id: string;
  applicantId: string;
  cycleId: string;
  formVersionId: string;
  answers: DraftAnswers;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

const drafts = new Map<string, MockDraft>();

/**
 * Mock-only switches for demonstrating states that are otherwise hard to reach:
 * an admissions window that is closed, and a save racing another device.
 */
export const scenario = {
  /** When false, the active-cycle read answers NO_ACTIVE_APPLICATION_CYCLE. */
  cycleIsOpen: true,
  /** When true, the next save is answered as a stale revision exactly once. */
  forceRevisionConflictOnce: false,
};

export function resetS2(): void {
  drafts.clear();
  scenario.cycleIsOpen = true;
  scenario.forceRevisionConflictOnce = false;
}

export function findDraftByApplicant(applicantId: string): MockDraft | undefined {
  return [...drafts.values()].find((draft) => draft.applicantId === applicantId);
}

export function findDraftById(applicationId: string): MockDraft | undefined {
  return drafts.get(applicationId);
}

export function createDraft(applicantId: string): MockDraft {
  const now = new Date().toISOString();
  const draft: MockDraft = {
    id: crypto.randomUUID(),
    applicantId,
    cycleId: CYCLE_ID,
    formVersionId: FORM_VERSION_ID,
    answers: {},
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
  drafts.set(draft.id, draft);
  return draft;
}

export function toApplicationDraft(draft: MockDraft): ApplicationDraft {
  return {
    id: draft.id,
    cycleId: draft.cycleId,
    formVersion,
    status: 'DRAFT',
    revision: draft.revision,
    answers: draft.answers,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export function applyAnswerPatch(draft: MockDraft, patch: Record<string, unknown>): void {
  const answers: DraftAnswers = { ...draft.answers };

  for (const [questionId, value] of Object.entries(patch)) {
    // Null, a blank trimmed text value and an empty multi-select all remove the
    // stored answer (specification section 31).
    const removes =
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);

    if (removes) {
      delete answers[questionId];
      continue;
    }

    answers[questionId] = value as DraftAnswers[string];
  }

  draft.answers = answers;
  draft.revision += 1;
  draft.updatedAt = new Date().toISOString();
}
