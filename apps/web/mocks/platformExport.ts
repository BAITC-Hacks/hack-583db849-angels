import { getUserById } from './db';
import { findDraftByApplicant, formVersion } from './s2';
import { blocks, findAttemptByApplication } from './s3';

/**
 * What inVision's platform sends the AI layer when an applicant submits:
 * `POST /v1/candidates` with the profile, the application's answers and the
 * test's. In the demo the mock world plays that platform, so this is its
 * export — read from tab memory, like everything else in it.
 *
 * The profile goes to the API, which keeps it and strips it (`toLLMView`)
 * before anything reaches a model. The answers are what the brief reads.
 */
export interface PlatformSnapshot {
  externalId: string;
  profile: Record<string, unknown>;
  application: { answers: { fieldId: string; question: string; answer: string }[] };
  test: { answers: { itemId: string; response: string }[] };
  englishCertificate?: { type: string; score: string };
}

export interface Readiness {
  /** Labels of the required questions still unanswered. */
  missing: string[];
  testComplete: boolean;
  ready: boolean;
}

/** The certificate is sent on its own, not as an answer. */
const CERTIFICATE_FIELDS = new Set(['english_certificate', 'english_certificate_score']);

function answerText(questionId: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const question = formVersion.questions.find((item) => item.id === questionId);
  if (question?.type === 'SINGLE_SELECT') {
    return question.options?.find((option) => option.value === value)?.label ?? String(value);
  }
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value).trim() || null;
}

function statementText(blockId: string, statementId: string | null): string | null {
  if (!statementId) return null;
  return blocks.find((block) => block.id === blockId)?.statements.find((statement) => statement.id === statementId)?.text ?? null;
}

export function readiness(applicantId: string): Readiness {
  const draft = findDraftByApplicant(applicantId);
  const answers = draft?.answers ?? {};
  const missing = formVersion.questions
    .filter((question) => question.required && answerText(question.id, answers[question.id]) === null)
    .map((question) => question.label);
  const attempt = draft ? findAttemptByApplication(draft.id) : undefined;
  const testComplete = Boolean(attempt?.completedAt);
  return { missing, testComplete, ready: missing.length === 0 && testComplete };
}

export function platformSnapshot(applicantId: string): PlatformSnapshot | null {
  const user = getUserById(applicantId);
  const draft = findDraftByApplicant(applicantId);
  if (!user || !draft) return null;

  const answers = formVersion.questions.flatMap((question) => {
    if (CERTIFICATE_FIELDS.has(question.id)) return [];
    const answer = answerText(question.id, draft.answers[question.id]);
    return answer === null ? [] : [{ fieldId: question.id, question: question.label, answer }];
  });

  // The test in its own words: what the applicant chose as most and least like them, block by block.
  const attempt = findAttemptByApplication(draft.id);
  const test = attempt
    ? attempt.blockOrder.flatMap((blockId) => {
        const progress = attempt.progress.get(blockId);
        if (progress?.status !== 'ANSWERED') return [];
        const most = statementText(blockId, progress.mostStatementId);
        const least = statementText(blockId, progress.leastStatementId);
        if (!most || !least) return [];
        return [{ itemId: blockId, response: `Most like me: ${most} Least like me: ${least}` }];
      })
    : [];

  const certificate = answerText('english_certificate', draft.answers.english_certificate);
  const score = answerText('english_certificate_score', draft.answers.english_certificate_score);

  return {
    externalId: `stand-${user.id}`,
    profile: { fullName: user.fullName, email: user.email, iin: user.iin, birthYear: user.birthYear },
    application: { answers },
    test: { answers: test },
    ...(certificate && score ? { englishCertificate: { type: certificate, score } } : {}),
  };
}

/** How far the applicant is, for the journey rail on the submission screen. */
export function railProgress(applicantId: string) {
  const draft = findDraftByApplicant(applicantId);
  const attempt = draft ? findAttemptByApplication(draft.id) : undefined;
  const done = attempt ? [...attempt.progress.values()].filter((block) => block.status !== 'ACTIVE').length : 0;
  return {
    application: { started: Boolean(draft), answered: Object.keys(draft?.answers ?? {}).length, total: formVersion.questions.length },
    test: { started: Boolean(attempt), done, total: attempt?.blockOrder.length ?? 0, complete: Boolean(attempt?.completedAt) },
  };
}

/** Which applicants have sent their application, and the candidate the AI layer made of it. */
const submissions = new Map<string, { candidateId: string; submittedAt: string }>();

export function markSubmitted(applicantId: string, candidateId: string): void {
  submissions.set(applicantId, { candidateId, submittedAt: new Date().toISOString() });
}

export function findSubmission(applicantId: string): { candidateId: string; submittedAt: string } | undefined {
  return submissions.get(applicantId);
}
