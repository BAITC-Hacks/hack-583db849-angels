import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody, SaveAnswersRequest } from '@invision/stand-client';
import {
  activeCycle,
  applyAnswerPatch,
  createDraft,
  findDraftByApplicant,
  findDraftById,
  formVersion,
  scenario,
  toApplicationDraft,
  CYCLE_ID,
} from './s2';
import { ACCESS_COOKIE, CSRF_COOKIE, errorBody, readRequestCookies } from './handlers';
import { findSession, getUserById } from './db';

/**
 * S2 draft operations, answering exactly the four approved operations.
 *
 * Ownership is derived from the session, never from the request: the server is
 * the only thing that decides whose draft this is, and a draft that belongs to
 * someone else is reported as not found rather than as forbidden, so the mock
 * does not leak that it exists.
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

export const s2Handlers = [
  http.get('/application-cycles/active', async ({ request }) => {
    await delay(250);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    if (!scenario.cycleIsOpen) {
      return HttpResponse.json(
        errorBody('NO_ACTIVE_APPLICATION_CYCLE', 'Applications are not currently open.'),
        { status: 404 },
      );
    }

    return HttpResponse.json(activeCycle, { status: 200 });
  }),

  http.post('/applications', async ({ request }) => {
    await delay(300);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    const csrf = csrfFailure(request);
    if (csrf) return HttpResponse.json(csrf, { status: 403 });

    if (!scenario.cycleIsOpen) {
      return HttpResponse.json(
        errorBody('NO_ACTIVE_APPLICATION_CYCLE', 'Applications are not currently open.'),
        { status: 404 },
      );
    }

    const body = (await request.json()) as { cycleId?: string };
    if (body?.cycleId !== CYCLE_ID) {
      return HttpResponse.json(errorBody('VALIDATION_ERROR', 'Request fields are invalid.'), { status: 400 });
    }

    // One draft per applicant and cycle; the second attempt is a deterministic
    // conflict rather than a duplicate.
    const existing = findDraftByApplicant(applicant.userId);
    if (existing) {
      return HttpResponse.json(
        errorBody('APPLICATION_ALREADY_EXISTS', 'An application already exists for this cycle.'),
        { status: 409 },
      );
    }

    return HttpResponse.json(toApplicationDraft(createDraft(applicant.userId)), { status: 201 });
  }),

  http.get('/applications/current', async ({ request }) => {
    await delay(250);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    const draft = findDraftByApplicant(applicant.userId);
    if (!draft) {
      return HttpResponse.json(errorBody('APPLICATION_NOT_FOUND', 'Application was not found.'), { status: 404 });
    }

    return HttpResponse.json(toApplicationDraft(draft), { status: 200 });
  }),

  http.patch('/applications/:applicationId/answers', async ({ request, params }) => {
    await delay(350);

    const applicant = requireApplicant(request);
    if (!applicant.ok) return applicant.response;

    const csrf = csrfFailure(request);
    if (csrf) return HttpResponse.json(csrf, { status: 403 });

    const draft = findDraftById(String(params.applicationId));
    // A draft that belongs to someone else is reported the same way as one that
    // does not exist, so ownership cannot be probed.
    if (!draft || draft.applicantId !== applicant.userId) {
      return HttpResponse.json(errorBody('APPLICATION_NOT_FOUND', 'Application was not found.'), { status: 404 });
    }

    const body = (await request.json()) as SaveAnswersRequest;

    if (body.formVersionId !== draft.formVersionId) {
      return HttpResponse.json(
        errorBody('FORM_VERSION_MISMATCH', 'The form version does not match this application.'),
        { status: 400 },
      );
    }

    if (!body.answers || Object.keys(body.answers).length === 0) {
      return HttpResponse.json(errorBody('VALIDATION_ERROR', 'Request fields are invalid.'), { status: 400 });
    }

    for (const [questionId, value] of Object.entries(body.answers)) {
      const question = formVersion.questions.find((item) => item.id === questionId);
      if (!question) {
        return HttpResponse.json(
          errorBody('UNKNOWN_QUESTION', 'An answer references an unknown question.', { questionId }),
          { status: 400 },
        );
      }
      if (value === null) continue;

      const expectsNumber = question.type === 'NUMBER';
      const expectsArray = question.type === 'MULTI_SELECT';
      const actual = Array.isArray(value) ? 'array' : typeof value;
      const wanted = expectsNumber ? 'number' : expectsArray ? 'array' : 'string';

      if (actual !== wanted) {
        return HttpResponse.json(
          errorBody('INVALID_ANSWER_TYPE', 'An answer has the wrong type.', { questionId }),
          { status: 400 },
        );
      }

      if (expectsNumber && typeof value === 'number') {
        const { minimum, maximum } = question.constraints ?? {};
        if (!Number.isFinite(value) || (minimum !== undefined && value < minimum) || (maximum !== undefined && value > maximum)) {
          return HttpResponse.json(
            errorBody('INVALID_ANSWER_VALUE', 'An answer is not valid for this question.', { questionId }),
            { status: 400 },
          );
        }
      }

      if (question.type === 'SINGLE_SELECT' && typeof value === 'string' && value.trim() !== '') {
        const allowed = (question.options ?? []).some((option) => option.value === value);
        if (!allowed) {
          return HttpResponse.json(
            errorBody('INVALID_ANSWER_VALUE', 'An answer is not valid for this question.', { questionId }),
            { status: 400 },
          );
        }
      }

      if (typeof value === 'string' && question.constraints?.maxLength !== undefined) {
        if (value.trim().length > question.constraints.maxLength) {
          return HttpResponse.json(
            errorBody('INVALID_ANSWER_VALUE', 'An answer is not valid for this question.', { questionId }),
            { status: 400 },
          );
        }
      }
    }

    if (scenario.forceRevisionConflictOnce) {
      scenario.forceRevisionConflictOnce = false;
      return HttpResponse.json(
        errorBody('DRAFT_REVISION_CONFLICT', 'The application changed since it was loaded.'),
        { status: 409 },
      );
    }

    if (body.expectedRevision !== draft.revision) {
      return HttpResponse.json(
        errorBody('DRAFT_REVISION_CONFLICT', 'The application changed since it was loaded.'),
        { status: 409 },
      );
    }

    applyAnswerPatch(draft, body.answers as Record<string, unknown>);
    return HttpResponse.json(toApplicationDraft(draft), { status: 200 });
  }),
];
