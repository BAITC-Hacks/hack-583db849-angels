import type {
  CurrentTestBlock,
  ForcedChoiceStatement,
  TestAttemptSummary,
  TestVersionSummary,
} from '@invision/stand-client';

/**
 * The approved synthetic seed from docs/slices/s3-forced-choice-test-
 * specification.md section 17: one published version, ten blocks, four socially
 * acceptable statements each, forty-five seconds a block.
 *
 * What is deliberately absent is the scoring key. Which competency a block
 * belongs to, and what a statement is worth, are private backend data; a
 * frontend fixture that carried them would leak the methodology to anyone who
 * opened the bundle. Statement identifiers are neutral for the same reason —
 * `statement_04_b` tells a reader nothing, where `values_honest` would.
 *
 * The statements are English because the assessment runs on English content.
 *
 * Everything below lives in memory for the lifetime of the tab. No attempt, no
 * deadline and no answer ever reaches browser storage.
 */
export const TEST_VERSION_ID = '66666666-6666-4666-8666-666666666666';

interface SeedBlock {
  id: string;
  prompt: string;
  statements: ForcedChoiceStatement[];
}

const BLOCK_SECONDS = 45;

export const testVersion: TestVersionSummary = {
  id: TEST_VERSION_ID,
  version: 1,
  title: 'Synthetic forced-choice demo',
  description: 'Synthetic, unvalidated prototype block set; not official admissions methodology.',
  publishedAt: '2026-09-20T12:00:00Z',
};

export const blocks: SeedBlock[] = [
  {
    id: 'block_01',
    prompt: 'In a group project, which is most like you and which is least like you?',
    statements: [
      { id: 'statement_01_a', text: 'I make sure everyone has said what they think before the group decides.' },
      { id: 'statement_01_b', text: 'I take the part of the work nobody has claimed.' },
      { id: 'statement_01_c', text: 'I hold the group to the plan we agreed on.' },
      { id: 'statement_01_d', text: 'I check in with whoever has gone quiet.' },
    ],
  },
  {
    id: 'block_02',
    prompt: 'Work needs to start and nobody has begun.',
    statements: [
      { id: 'statement_02_a', text: 'I start on a task before anyone assigns it.' },
      { id: 'statement_02_b', text: 'I ask who is doing what, and write it down.' },
      { id: 'statement_02_c', text: 'I take the responsibility if the result turns out wrong.' },
      { id: 'statement_02_d', text: 'I persuade people by showing a first version instead of arguing.' },
    ],
  },
  {
    id: 'block_03',
    prompt: 'When you choose where to study.',
    statements: [
      { id: 'statement_03_a', text: 'I choose by the people I would be studying with.' },
      { id: 'statement_03_b', text: 'I choose by what the place would let me build.' },
      { id: 'statement_03_c', text: 'I choose by how it teaches, not by what it promises.' },
      { id: 'statement_03_d', text: 'I choose by where its graduates end up.' },
    ],
  },
  {
    id: 'block_04',
    prompt: 'About the field you picked.',
    statements: [
      { id: 'statement_04_a', text: 'A specific problem in it keeps bothering me.' },
      { id: 'statement_04_b', text: 'I am good at the kind of work it asks for.' },
      { id: 'statement_04_c', text: 'It connects to what I want to be doing afterwards.' },
      { id: 'statement_04_d', text: 'I tried it and did not want to stop.' },
    ],
  },
  {
    id: 'block_05',
    prompt: 'When a decision has a cost.',
    statements: [
      { id: 'statement_05_a', text: 'I would rather the result be fair than fast.' },
      { id: 'statement_05_b', text: 'I say so when a rule does not fit the situation.' },
      { id: 'statement_05_c', text: 'I take the part that is unpleasant but necessary.' },
      { id: 'statement_05_d', text: 'I keep a promise even when nobody would notice.' },
    ],
  },
  {
    id: 'block_06',
    prompt: 'Outside the classroom.',
    statements: [
      { id: 'statement_06_a', text: 'I have finished something other people went on to use.' },
      { id: 'statement_06_b', text: 'I have worked somewhere I did not choose my own tasks.' },
      { id: 'statement_06_c', text: 'I have organised something that needed other people to show up.' },
      { id: 'statement_06_d', text: 'I have kept a project going after the first interest faded.' },
    ],
  },
  {
    id: 'block_07',
    prompt: 'When a problem is unfamiliar.',
    statements: [
      { id: 'statement_07_a', text: 'I look for the rule behind it before solving it.' },
      { id: 'statement_07_b', text: 'I explain it to myself with a simpler example.' },
      { id: 'statement_07_c', text: 'I change my mind when a fact does not fit.' },
      { id: 'statement_07_d', text: 'I read something difficult to the end even when it is slow.' },
    ],
  },
  {
    id: 'block_08',
    prompt: 'About the work you want to do.',
    statements: [
      { id: 'statement_08_a', text: 'I want it to matter to people outside my own circle.' },
      { id: 'statement_08_b', text: 'I judge a decision by who it leaves out.' },
      { id: 'statement_08_c', text: 'I would rather build something lasting than something noticed.' },
      { id: 'statement_08_d', text: 'I lead when the goal is something I would pursue anyway.' },
    ],
  },
  {
    id: 'block_09',
    prompt: 'When a group disagrees.',
    statements: [
      { id: 'statement_09_a', text: 'I would rather settle a disagreement early than keep the peace.' },
      { id: 'statement_09_b', text: 'I give credit by name.' },
      { id: 'statement_09_c', text: 'I ask for help before the deadline rather than after it.' },
      { id: 'statement_09_d', text: "I let someone else's plan win when it is workable." },
    ],
  },
  {
    id: 'block_10',
    prompt: 'When you are working something out.',
    statements: [
      { id: 'statement_10_a', text: 'I keep notes I can come back to months later.' },
      { id: 'statement_10_b', text: 'I test an assumption with a small experiment.' },
      { id: 'statement_10_c', text: 'I ask what evidence would prove me wrong.' },
      { id: 'statement_10_d', text: 'I finish the analysis before proposing an answer.' },
    ],
  },
];

type BlockStatus = 'ACTIVE' | 'ANSWERED' | 'TIMED_OUT';

interface MockBlockProgress {
  blockId: string;
  status: BlockStatus;
  mostStatementId: string | null;
  leastStatementId: string | null;
  startedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
}

export interface MockAttempt {
  id: string;
  applicationId: string;
  applicantId: string;
  /** Persisted once, at creation: a reload must not reshuffle anything. */
  blockOrder: string[];
  statementOrders: Record<string, string[]>;
  progress: Map<string, MockBlockProgress>;
  revision: number;
  startedAt: string;
  completedAt: string | null;
}

const attempts = new Map<string, MockAttempt>();

/**
 * Mock-only switches. The block time limit is version data, not a runtime
 * setting, so overriding it is a demonstration device and nothing more: the
 * lowest value the contract allows is ten seconds, which is short enough to
 * watch a block time out without waiting three quarters of a minute.
 */
export const scenario = {
  /** Seconds for blocks started from now on, or null for the published value. */
  timeLimitSecondsOverride: null as number | null,
};

export function resetS3(): void {
  attempts.clear();
  scenario.timeLimitSecondsOverride = null;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function findAttemptByApplication(applicationId: string): MockAttempt | undefined {
  return [...attempts.values()].find((attempt) => attempt.applicationId === applicationId);
}

export function findAttemptById(attemptId: string): MockAttempt | undefined {
  return attempts.get(attemptId);
}

export function createAttempt(applicationId: string, applicantId: string): MockAttempt {
  const attempt: MockAttempt = {
    id: crypto.randomUUID(),
    applicationId,
    applicantId,
    blockOrder: shuffled(blocks).map((block) => block.id),
    statementOrders: Object.fromEntries(
      blocks.map((block) => [block.id, shuffled(block.statements).map((statement) => statement.id)]),
    ),
    progress: new Map(),
    revision: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  attempts.set(attempt.id, attempt);
  return attempt;
}

function terminalCount(attempt: MockAttempt, status: BlockStatus): number {
  return [...attempt.progress.values()].filter((progress) => progress.status === status).length;
}

export function toSummary(attempt: MockAttempt): TestAttemptSummary {
  const completed = attempt.revision >= attempt.blockOrder.length;

  return {
    id: attempt.id,
    applicationId: attempt.applicationId,
    testVersion: testVersion,
    status: completed ? 'COMPLETED' : 'IN_PROGRESS',
    totalBlocks: attempt.blockOrder.length,
    answeredBlocks: terminalCount(attempt, 'ANSWERED'),
    timedOutBlocks: terminalCount(attempt, 'TIMED_OUT'),
    // One-based position of the block being worked on, and null once there is
    // none left. Revision is the count of finished blocks, so it is also the
    // index of the next one.
    currentBlockNumber: completed ? null : attempt.revision + 1,
    revision: attempt.revision,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
  };
}

export function publicBlock(attempt: MockAttempt, progress: MockBlockProgress): CurrentTestBlock {
  const block = blocks.find((candidate) => candidate.id === progress.blockId);
  if (!block) throw new Error(`unknown block ${progress.blockId}`);

  const order = attempt.statementOrders[block.id] ?? block.statements.map((statement) => statement.id);

  return {
    id: block.id,
    position: attempt.blockOrder.indexOf(block.id) + 1,
    prompt: block.prompt,
    statements: order.map((id) => {
      const statement = block.statements.find((candidate) => candidate.id === id);
      if (!statement) throw new Error(`unknown statement ${id}`);
      return statement;
    }),
    timeLimitSeconds: Math.round(
      (Date.parse(progress.expiresAt) - Date.parse(progress.startedAt)) / 1000,
    ),
    startedAt: progress.startedAt,
    expiresAt: progress.expiresAt,
  };
}

export function activeProgress(attempt: MockAttempt): MockBlockProgress | undefined {
  return [...attempt.progress.values()].find((progress) => progress.status === 'ACTIVE');
}

function startNextBlock(attempt: MockAttempt): MockBlockProgress | null {
  if (attempt.revision >= attempt.blockOrder.length) {
    attempt.completedAt = attempt.completedAt ?? new Date().toISOString();
    return null;
  }

  const blockId = attempt.blockOrder[attempt.revision];
  const seconds = scenario.timeLimitSecondsOverride ?? BLOCK_SECONDS;
  const startedAt = new Date();
  const progress: MockBlockProgress = {
    blockId,
    status: 'ACTIVE',
    mostStatementId: null,
    leastStatementId: null,
    startedAt: startedAt.toISOString(),
    expiresAt: new Date(startedAt.getTime() + seconds * 1000).toISOString(),
    resolvedAt: null,
  };
  attempt.progress.set(blockId, progress);
  return progress;
}

/**
 * Starting and resuming are the same operation, and that is the point: a reload
 * must return the deadline the server already set rather than buy the applicant
 * another forty-five seconds. Only an expired block moves anything — it becomes
 * TIMED_OUT, the attempt advances once, and the next block starts.
 */
export function startOrResumeCurrent(attempt: MockAttempt): {
  block: MockBlockProgress | null;
  timedOutOnThisRequest: boolean;
} {
  const active = activeProgress(attempt);
  let timedOut = false;

  if (active) {
    if (Date.now() < Date.parse(active.expiresAt)) return { block: active, timedOutOnThisRequest: false };

    active.status = 'TIMED_OUT';
    active.resolvedAt = new Date().toISOString();
    attempt.revision += 1;
    timedOut = true;
  }

  return { block: startNextBlock(attempt), timedOutOnThisRequest: timedOut };
}

export type SubmitOutcome =
  | { kind: 'resolved'; outcome: 'ANSWERED' | 'TIMED_OUT'; resolvedAt: string }
  | {
      kind: 'error';
      code:
        | 'TEST_BLOCK_NOT_CURRENT'
        | 'TEST_BLOCK_LOCKED'
        | 'TEST_REVISION_CONFLICT'
        | 'UNKNOWN_TEST_STATEMENT';
    };

/**
 * Resolves the current block once and for all.
 *
 * An identical retry of a stored answer returns that answer, because a lost
 * response must not cost the applicant the block. A different pair for a block
 * that is already answered is refused, and anything sent to a timed-out block
 * gets the timeout back.
 */
export function submitResponse(
  attempt: MockAttempt,
  blockId: string,
  expectedRevision: number,
  mostStatementId: string,
  leastStatementId: string,
): SubmitOutcome {
  const stored = attempt.progress.get(blockId);

  if (stored && stored.status !== 'ACTIVE') {
    if (stored.status === 'TIMED_OUT') {
      return { kind: 'resolved', outcome: 'TIMED_OUT', resolvedAt: stored.resolvedAt ?? stored.expiresAt };
    }
    const sameAnswer = stored.mostStatementId === mostStatementId && stored.leastStatementId === leastStatementId;
    return sameAnswer
      ? { kind: 'resolved', outcome: 'ANSWERED', resolvedAt: stored.resolvedAt ?? stored.expiresAt }
      : { kind: 'error', code: 'TEST_BLOCK_LOCKED' };
  }

  const active = activeProgress(attempt);
  if (!active || active.blockId !== blockId) return { kind: 'error', code: 'TEST_BLOCK_NOT_CURRENT' };
  if (expectedRevision !== attempt.revision) return { kind: 'error', code: 'TEST_REVISION_CONFLICT' };

  // Membership is checked here rather than before, because the specification
  // fixes the order: a pair is "distinct, current, known". A statement is only
  // known relative to the block the applicant is actually on, so answering the
  // wrong block is that error and not an unknown statement.
  if (!statementBelongsToBlock(blockId, mostStatementId) || !statementBelongsToBlock(blockId, leastStatementId)) {
    return { kind: 'error', code: 'UNKNOWN_TEST_STATEMENT' };
  }

  const resolvedAt = new Date().toISOString();
  const expired = Date.now() >= Date.parse(active.expiresAt);

  active.status = expired ? 'TIMED_OUT' : 'ANSWERED';
  active.resolvedAt = resolvedAt;
  if (!expired) {
    active.mostStatementId = mostStatementId;
    active.leastStatementId = leastStatementId;
  }
  attempt.revision += 1;
  if (attempt.revision >= attempt.blockOrder.length) attempt.completedAt = resolvedAt;

  return { kind: 'resolved', outcome: expired ? 'TIMED_OUT' : 'ANSWERED', resolvedAt };
}

/**
 * Closes the first blocks of an attempt without playing them out.
 *
 * Demonstration only: it exists so a seeded applicant can be found halfway
 * through the test, which is the only way to show a resumed attempt, a rail
 * that has moved and a cabinet with numbers in it without answering ten blocks
 * by hand first. Nothing in the app calls it — the seed does.
 */
export function seedTerminalBlocks(attempt: MockAttempt, answered: number, timedOut: number): void {
  const closed = Math.min(answered + timedOut, attempt.blockOrder.length);

  for (let index = 0; index < closed; index += 1) {
    const blockId = attempt.blockOrder[index];
    const block = blocks.find((candidate) => candidate.id === blockId);
    if (!block) continue;

    const order = attempt.statementOrders[blockId] ?? block.statements.map((statement) => statement.id);
    const wasAnswered = index < answered;
    const startedAt = new Date(Date.now() - (closed - index) * 90 * 1000);
    const expiresAt = new Date(startedAt.getTime() + BLOCK_SECONDS * 1000);

    attempt.progress.set(blockId, {
      blockId,
      status: wasAnswered ? 'ANSWERED' : 'TIMED_OUT',
      mostStatementId: wasAnswered ? order[0] : null,
      leastStatementId: wasAnswered ? order[1] : null,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      resolvedAt: new Date(startedAt.getTime() + 20 * 1000).toISOString(),
    });
  }

  attempt.revision = closed;
  if (closed >= attempt.blockOrder.length) attempt.completedAt = new Date().toISOString();
}

export function statementBelongsToBlock(blockId: string, statementId: string): boolean {
  const block = blocks.find((candidate) => candidate.id === blockId);
  return Boolean(block?.statements.some((statement) => statement.id === statementId));
}
