import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody, AuthSession, LoginRequest, RegisterApplicantRequest } from '@invision/stand-client';
import { validateLoginFields, validateRegisterFields } from '../lib/validation/identity';
import {
  clearSessionMarker,
  createSession,
  createUser,
  findSession,
  findUserByEmail,
  findUserByIin,
  getUserById,
  readSessionMarker,
  recordAttempt,
  resetAttempts,
  revokeAllSessionsForUser,
  rotateSession,
  toPublicUser,
} from './db';

/**
 * Mock cookie names for local/mock mode only (plain HTTP, no __Host- prefix).
 * Staging uses the __Host-invision_* names fixed by openapi.yaml and set by
 * the real backend. See lib/api/config.ts for the coordination note.
 */
export const ACCESS_COOKIE = 'invision_access';
export const REFRESH_COOKIE = 'invision_refresh';
export const CSRF_COOKIE = 'invision_csrf';

const ACCESS_MAX_AGE = 900;
const REFRESH_MAX_AGE = 604800;

/**
 * Service Workers never expose the incoming `Cookie` header to a `fetch`
 * event's Request (the browser strips it before the event fires), so a
 * handler can't read `request.headers.get('cookie')`. MSW resolves requests
 * on the page's main thread though, so `document.cookie` — the same source
 * the generated client reads the CSRF token from — has what we need instead.
 */
export function readRequestCookies(request?: Request): Record<string, string> {
  const result: Record<string, string> = {};

  // A server reads cookies off the request, and so does this when it can. The
  // browser-mode worker cannot see them there — MSW does not attach a Cookie
  // header — so `document.cookie` remains the fallback it has always been.
  const header = request?.headers.get('cookie');
  const source = header ?? (typeof document === 'undefined' ? null : document.cookie);
  if (!source) return result;

  for (const part of source.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) continue;
    result[rawKey] = decodeURIComponent(rawValue.join('='));
  }
  return result;
}

/**
 * Browser-mode mock cookies are written straight to `document.cookie` instead
 * of being returned as `Set-Cookie` headers, for two reasons.
 *
 * Chromium silently drops `HttpOnly` cookies set by a Service-Worker-
 * synthesized Response (verified empirically: a non-HttpOnly cookie in the same
 * multi-Set-Cookie response survives; HttpOnly ones do not), so the mock could
 * never be faithful there anyway. And MSW mirrors every `Set-Cookie` it sees
 * into a `__msw-cookie-store__` entry in localStorage — a second place where
 * mock session state would sit on disk, which the storage rule forbids.
 *
 * Handlers run on the page's main thread, so writing the cookie directly has
 * the same effect with neither drawback. The Node-only fixture handler has no
 * browser storage, so it returns the documented headers for contract
 * conformance. The real backend still sets genuine HttpOnly cookies per
 * docs/slices/s1-identity.md; nothing here weakens that.
 */
function writeSessionCookies(session: { id: string; csrfToken: string }): Headers | undefined {
  if (typeof document === 'undefined') {
    const headers = new Headers();
    headers.append('Set-Cookie', `${ACCESS_COOKIE}=${session.id}; Path=/; Max-Age=${ACCESS_MAX_AGE}; SameSite=Lax`);
    headers.append('Set-Cookie', `${REFRESH_COOKIE}=${session.id}; Path=/; Max-Age=${REFRESH_MAX_AGE}; SameSite=Lax`);
    headers.append('Set-Cookie', `${CSRF_COOKIE}=${session.csrfToken}; Path=/; Max-Age=${REFRESH_MAX_AGE}; SameSite=Lax`);
    return headers;
  }
  document.cookie = `${ACCESS_COOKIE}=${session.id}; Path=/; Max-Age=${ACCESS_MAX_AGE}; SameSite=Lax`;
  document.cookie = `${REFRESH_COOKIE}=${session.id}; Path=/; Max-Age=${REFRESH_MAX_AGE}; SameSite=Lax`;
  document.cookie = `${CSRF_COOKIE}=${session.csrfToken}; Path=/; Max-Age=${REFRESH_MAX_AGE}; SameSite=Lax`;
  return undefined;
}

/**
 * Signs the marked account back in after a document load.
 *
 * The cookies from the previous document point at sessions that no longer
 * exist — this store is rebuilt with the page — so a fresh session is created
 * for the marked user and new cookies are written. Nothing is resurrected: no
 * old token is trusted, and no applicant data comes back with it.
 */
export function restoreMarkedSession(): void {
  const userId = readSessionMarker();
  if (!userId) return;

  const user = getUserById(userId);
  if (!user) {
    clearSessionMarker();
    return;
  }

  writeSessionCookies(createSession(user.id));
}

export function clearSessionCookies(): Headers | undefined {
  if (typeof document === 'undefined') {
    const headers = new Headers();
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
      headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0`);
    }
    return headers;
  }
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
  return undefined;
}

export function errorBody(code: ApiErrorBody['code'], message: string, details?: ApiErrorBody['details']): ApiErrorBody {
  return { code, message, details, traceId: `mock_${Date.now().toString(36)}` };
}

function toSession(session: { id: string; userId: string; accessExpiresAt: number }): AuthSession {
  const user = getUserById(session.userId);
  if (!user) throw new Error('mock inconsistency: session without user');
  return {
    user: toPublicUser(user),
    accessExpiresAt: new Date(session.accessExpiresAt).toISOString(),
  };
}

/** Deterministic QA trigger: register/login with this address to see a 500. */
const SERVER_ERROR_TRIGGER_EMAIL = 'servererror@example.test';

export const handlers = [
  /**
   * The API's own health endpoint. The landing page badge does not call it in
   * mock mode — it says so outright instead — but the contract declares the
   * operation, so the mock answers it.
   */
  http.get('/health', () => HttpResponse.json({ status: 'ok' }, { status: 200 })),

  http.post('/auth/register', async ({ request }) => {
    await delay(400);
    const payload = (await request.json()) as RegisterApplicantRequest;
    const email = payload.email?.trim().toLowerCase() ?? '';

    const fieldErrors = validateRegisterFields({
      email: payload.email ?? '',
      iin: payload.iin ?? '',
      fullName: payload.fullName ?? '',
      birthYear: payload.birthYear ?? null,
      password: payload.password ?? '',
    });
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(errorBody('VALIDATION_ERROR', 'Request fields are invalid.', { fields: fieldErrors }), {
        status: 400,
      });
    }

    const rateLimit = recordAttempt(`register:${email}`);
    if (rateLimit.limited) {
      return HttpResponse.json(errorBody('RATE_LIMITED', 'Try again later.'), {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    if (email === SERVER_ERROR_TRIGGER_EMAIL) {
      return HttpResponse.json(errorBody('INTERNAL_ERROR', 'An unexpected error occurred. Try again later.'), {
        status: 500,
      });
    }

    if (findUserByEmail(email) || findUserByIin(payload.iin)) {
      return HttpResponse.json(errorBody('REGISTRATION_FAILED', 'We could not create an account with these details.'), {
        status: 400,
      });
    }

    const user = createUser({
      email,
      iin: payload.iin,
      fullName: payload.fullName.trim(),
      birthYear: payload.birthYear,
      password: payload.password,
    });
    resetAttempts(`register:${email}`);
    const session = createSession(user.id);
    const headers = writeSessionCookies(session);

    return HttpResponse.json(toSession(session), { status: 201, headers });
  }),

  http.post('/auth/login', async ({ request }) => {
    await delay(400);
    const payload = (await request.json()) as LoginRequest;
    const email = payload.email?.trim().toLowerCase() ?? '';

    const fieldErrors = validateLoginFields({ email: payload.email ?? '', password: payload.password ?? '' });
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(errorBody('VALIDATION_ERROR', 'Request fields are invalid.', { fields: fieldErrors }), {
        status: 400,
      });
    }

    const rateLimit = recordAttempt(`login:${email}`);
    if (rateLimit.limited) {
      return HttpResponse.json(errorBody('RATE_LIMITED', 'Try again later.'), {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    if (email === SERVER_ERROR_TRIGGER_EMAIL) {
      return HttpResponse.json(errorBody('INTERNAL_ERROR', 'An unexpected error occurred. Try again later.'), {
        status: 500,
      });
    }

    const user = findUserByEmail(email);
    if (!user || user.password !== payload.password) {
      return HttpResponse.json(
        errorBody('INVALID_CREDENTIALS', 'We could not sign you in. Check your email and password and try again.'),
        { status: 401 },
      );
    }

    resetAttempts(`login:${email}`);
    const session = createSession(user.id);
    const headers = writeSessionCookies(session);
    return HttpResponse.json(toSession(session), { status: 200, headers });
  }),

  http.post('/auth/refresh', async ({ request }) => {
    await delay(250);
    const cookies = readRequestCookies(request);
    const session = findSession(cookies[REFRESH_COOKIE]);
    if (!session) {
      return HttpResponse.json(errorBody('UNAUTHORIZED', 'Authentication is required.'), { status: 401 });
    }

    const csrfHeader = request.headers.get('x-csrf-token');
    if (!csrfHeader || csrfHeader !== session.csrfToken) {
      return HttpResponse.json(errorBody('CSRF_VALIDATION_FAILED', 'The request could not be verified.'), {
        status: 403,
      });
    }

    const rotated = rotateSession(session.id);
    if (!rotated) {
      return HttpResponse.json(errorBody('UNAUTHORIZED', 'Authentication is required.'), { status: 401 });
    }
    const headers = writeSessionCookies(rotated);
    return HttpResponse.json(toSession(rotated), { status: 200, headers });
  }),

  /**
   * Logout is conditional on the refresh cookie (D-018, CON-017).
   *
   * The order matters and is the whole fix: CSRF is validated whenever a
   * refresh cookie is present, before the cookie is resolved to a session. The
   * previous implementation only checked CSRF after the cookie resolved, so a
   * present but expired cookie skipped the check — and the two cases answered
   * differently, which told a caller whether the session was still live.
   */
  http.post('/auth/logout', async ({ request }) => {
    await delay(200);
    const cookies = readRequestCookies(request);
    const refreshToken = cookies[REFRESH_COOKIE];

    // No cookie: anonymous and idempotent. There is no session to protect, and
    // a caller that lost its cookies must still be able to finish logging out.
    if (!refreshToken) {
      const headers = clearSessionCookies();
      return new HttpResponse(null, { status: 204, headers });
    }

    const csrfHeader = request.headers.get('x-csrf-token');
    if (!csrfHeader || csrfHeader !== cookies[CSRF_COOKIE]) {
      // Nothing is cleared and nothing is revoked: clearing on a failed check
      // would let a forged request log the user out.
      return HttpResponse.json(errorBody('CSRF_VALIDATION_FAILED', 'The request could not be verified.'), {
        status: 403,
      });
    }

    const session = findSession(refreshToken);
    if (session) revokeAllSessionsForUser(session.userId);

    // A live session and a stale cookie end the same way, so the response does
    // not disclose which one it was.
    const headers = clearSessionCookies();
    return new HttpResponse(null, { status: 204, headers });
  }),

  http.get('/auth/me', async ({ request }) => {
    await delay(200);
    const cookies = readRequestCookies(request);
    const session = findSession(cookies[ACCESS_COOKIE]);
    if (!session) {
      return HttpResponse.json(errorBody('UNAUTHORIZED', 'Authentication is required.'), { status: 401 });
    }
    const user = getUserById(session.userId);
    if (!user) {
      return HttpResponse.json(errorBody('UNAUTHORIZED', 'Authentication is required.'), { status: 401 });
    }
    return HttpResponse.json(toPublicUser(user), { status: 200 });
  }),
];
