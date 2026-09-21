import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody } from '@invision/stand-client';
import { ACCESS_COOKIE, CSRF_COOKIE, errorBody, readRequestCookies } from './handlers';
import { findSession, getUserById } from './db';
import { findDraftById } from './s2';
import {
  activeProgress,
  createAttempt,
  findAttemptByApplication,
  findAttemptById,
  publicBlock,
  startOrResumeCurrent,
  submitResponse,
  toSummary,
} from './s3';

/**
 * The four approved forced-choice operations.
 *
 * Two rules run through all of them. Ownership is derived from the session and
 * the application behind the attempt, never from anything the caller sends; and
 * an attempt that belongs to somebody else answers exactly like one that does
 * not exist, so the mock cannot be used to discover that it does.
 *
 * Time is the server's. Every deadline is compared against the mock's own clock
 * and `serverTime` is returned with each response, because a browser that
 * trusted its own clock could grant itself more time by changing it.
 */
function requireApplicant(request?: Request): { ok: true; userId: string } | { ok: false; response: Response } {
  const cookies = readRequestCookies(request);
  const session = findSession(cookies[ACCESS_COOKIE]);
  const user = session ? getUserById(session.userId) : undefined;

  if (!session || !user) {
    return {
      ok: false,
      response: HttpResponse.json(errorBody('UNAUTHORIZED', 'Authentication is required.'), { status: 401 }),
    };
  }

  if (user.role !== 'APPLICANT') {
    return {
      ok: false,
      response: HttpResponse.json(errorBody('FORBIDDEN', 'Access is denied.'), { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}

function csrfFailure(request: Request): ApiErrorBody | null {
  const cookies = readRequestCookies(request);
  const header = request.headers.get('x-csrf-token');
  if (header && header === cookies[CSRF_COOKIE]) return null;
  return errorBody('CSRF_VALIDATION_FAILED', 'The request could not be verified.');
}

const attemptNotFound = () =>
  HttpResponse.json(errorBody('TEST_ATTEMPT_NOT_FOUND', 'The attempt could not be found.'), { status: 404 });

export const s3Handlers = [
  http.post('/applications/:applicationId/test-attempt', async ({ request, params }) => {
    await delay(250);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    const csrf = csrfFailure(request);
    if (csrf) return HttpResponse.json(csrf, { status: 403 });

    const applicationId = String(params.applicationId);
    const draft = findDraftById(applicationId);

    // A foreign application is reported as missing: the caller learns nothing
    // about applications that are not theirs.
    if (!draft || draft.applicantId !== applicant.userId) {
      return HttpResponse.json(errorBody('APPLICATION_NOT_FOUND', 'The application could not be found.'), {
        status: 404,
      });
    }

    if (findAttemptByApplication(applicationId)) {
      return HttpResponse.json(
        errorBody('TEST_ATTEMPT_ALREADY_EXISTS', 'This application already has an attempt.'),
        { status: 409 },
      );
    }

    const attempt = createAttempt(applicationId, applicant.userId);
    return HttpResponse.json(toSummary(attempt), { status: 201 });
  }),

  http.get('/applications/:applicationId/test-attempt', async ({ request, params }) => {
    await delay(200);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    const attempt = findAttemptByApplication(String(params.applicationId));
    if (!attempt || attempt.applicantId !== applicant.userId) return attemptNotFound();

    return HttpResponse.json(toSummary(attempt), { status: 200 });
  }),

  http.post('/test-attempts/:attemptId/current-block', async ({ request, params }) => {
    await delay(200);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    const csrf = csrfFailure(request);
    if (csrf) return HttpResponse.json(csrf, { status: 403 });

    const attempt = findAttemptById(String(params.attemptId));
    if (!attempt || attempt.applicantId !== applicant.userId) return attemptNotFound();

    const { block, timedOutOnThisRequest } = startOrResumeCurrent(attempt);

    return HttpResponse.json(
      {
        attempt: toSummary(attempt),
        currentBlock: block ? publicBlock(attempt, block) : null,
        serverTime: new Date().toISOString(),
        timedOutOnThisRequest,
      },
      { status: 200 },
    );
  }),

  http.put('/test-attempts/:attemptId/blocks/:blockId/response', async ({ request, params }) => {
    await delay(200);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    const csrf = csrfFailure(request);
    if (csrf) return HttpResponse.json(csrf, { status: 403 });

    const attempt = findAttemptById(String(params.attemptId));
    if (!attempt || attempt.applicantId !== applicant.userId) return attemptNotFound();

    const blockId = String(params.blockId);
    const payload = (await request.json().catch(() => null)) as {
      expectedRevision?: unknown;
      mostStatementId?: unknown;
      leastStatementId?: unknown;
    } | null;

    if (
      !payload ||
      typeof payload.expectedRevision !== 'number' ||
      typeof payload.mostStatementId !== 'string' ||
      typeof payload.leastStatementId !== 'string'
    ) {
      return HttpResponse.json(errorBody('VALIDATION_ERROR', 'Request fields are invalid.'), { status: 400 });
    }

    const { expectedRevision, mostStatementId, leastStatementId } = payload;

    if (mostStatementId === leastStatementId) {
      return HttpResponse.json(
        errorBody('SAME_MOST_AND_LEAST', 'The two selections must be different statements.'),
        { status: 400 },
      );
    }

    const result = submitResponse(attempt, blockId, expectedRevision, mostStatementId, leastStatementId);

    if (result.kind === 'error') {
      if (result.code === 'UNKNOWN_TEST_STATEMENT') {
        return HttpResponse.json(
          errorBody('UNKNOWN_TEST_STATEMENT', 'A selected statement does not belong to this block.'),
          { status: 400 },
        );
      }

      const message =
        result.code === 'TEST_BLOCK_LOCKED'
          ? 'This block has already been answered.'
          : result.code === 'TEST_REVISION_CONFLICT'
            ? 'The attempt has moved on since this block was loaded.'
            : 'This is not the current block.';
      return HttpResponse.json(errorBody(result.code, message), { status: 409 });
    }

    return HttpResponse.json(
      {
        attempt: toSummary(attempt),
        result: { blockId, outcome: result.outcome, resolvedAt: result.resolvedAt },
        serverTime: new Date().toISOString(),
      },
      { status: 200 },
    );
  }),
];

/** Exposed for tests that need to look at the block a caller is currently on. */
export { activeProgress };
