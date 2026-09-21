import type { Role, UserPublic } from '@invision/stand-client';
import {
  DEMO_APPLICANT_EMAIL,
  DEMO_APPLICANT_ID,
  DEMO_PASSPHRASE,
  MIDWAY_APPLICANT_EMAIL,
  MIDWAY_APPLICANT_ID,
} from './accounts';

/**
 * In-memory fixture store for NEXT_PUBLIC_API_MODE=mock only. Passwords are
 * kept in plaintext here purely to compare against login attempts inside the
 * mock — real storage uses Argon2id per docs/slices/s1-identity.md and must
 * never resemble this file.
 */
interface MockUser {
  id: string;
  email: string;
  iin: string;
  fullName: string;
  birthYear: number;
  password: string;
  role: Role;
  createdAt: string;
}

interface MockSession {
  id: string;
  userId: string;
  csrfToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const users = new Map<string, MockUser>();
const sessions = new Map<string, MockSession>();
const attempts = new Map<string, number[]>();

/**
 * Mock users, sessions, drafts and answers live for the lifetime of the tab.
 *
 * One exception, and only one: which synthetic account was signed in survives a
 * document load, stored as the id of a seeded user and nothing else. An earlier
 * version wrote the whole store to localStorage — a full user object with IIN,
 * birth year and password, with every applicant answer bound to join it — which
 * the S2 specification forbids outright. A single opaque id is not that: no
 * token, no personal data, no answers, and restoring it creates a fresh session
 * rather than resurrecting an old one.
 *
 * It exists because changing the interface language loads a new document, and
 * being thrown out of the cabinet every time somebody switches language makes
 * the product impossible to look at. Applicant data is still lost on that load;
 * that part of the rule is working as intended.
 *
 * The only key this application may write is the theme preference.
 */
const LEGACY_STORAGE_KEYS = ['invision-mock-db-v1', '__msw-cookie-store__'];

/** The one key mock auth may write: a seeded user id, nothing else. */
const SESSION_MARKER_KEY = 'invision-mock-session';

export function writeSessionMarker(userId: string): void {
  if (typeof localStorage === 'undefined') return;
  // Only the seeded accounts are restorable. Anyone registered inside the tab
  // exists only there, and a marker pointing at them would be a promise the
  // mock cannot keep after a reload.
  if (userId !== DEMO_APPLICANT_ID && userId !== MIDWAY_APPLICANT_ID) return;
  try {
    localStorage.setItem(SESSION_MARKER_KEY, userId);
  } catch {
    // Private windows and blocked site data simply do not keep the session.
  }
}

export function clearSessionMarker(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_MARKER_KEY);
  } catch {
    // Nothing to clear is not a failure.
  }
}

export function readSessionMarker(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(SESSION_MARKER_KEY);
  } catch {
    return null;
  }
}

/**
 * Removes anything a previous build left behind, so test data written before
 * this rule existed cannot be read back on an upgrade.
 */
export function purgeLegacyMockStorage(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Private windows and blocked site data are fine: there is nothing to purge.
    }
  }
}

/**
 * Two synthetic applicants, because one is not enough to show the product.
 *
 * The first has just signed up: every screen from an empty application onward
 * can be demonstrated from it. The second is halfway through, which is the only
 * way to show a cabinet with numbers in it, a journey rail that has moved, and a
 * test that resumes where it was left — without sitting through ten blocks
 * first.
 *
 * Both are synthetic. The IINs are zeroes and ones rather than anything that
 * could belong to a person.
 */
export {
  DEMO_APPLICANT_EMAIL,
  DEMO_APPLICANT_ID,
  DEMO_PASSPHRASE,
  MIDWAY_APPLICANT_EMAIL,
  MIDWAY_APPLICANT_ID,
} from './accounts';

function seedDemoUser() {
  const demo: MockUser = {
    id: DEMO_APPLICANT_ID,
    email: DEMO_APPLICANT_EMAIL,
    iin: '000000000000',
    fullName: 'Demo Applicant',
    birthYear: 2000,
    password: DEMO_PASSPHRASE,
    role: 'APPLICANT',
    createdAt: new Date().toISOString(),
  };
  users.set(demo.email, demo);

  const midway: MockUser = {
    id: MIDWAY_APPLICANT_ID,
    email: MIDWAY_APPLICANT_EMAIL,
    iin: '111111111111',
    fullName: 'Midway Applicant',
    birthYear: 2001,
    password: DEMO_PASSPHRASE,
    role: 'APPLICANT',
    createdAt: new Date().toISOString(),
  };
  users.set(midway.email, midway);
}


purgeLegacyMockStorage();
seedDemoUser();

export function toPublicUser(user: MockUser): UserPublic {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function findUserByEmail(email: string) {
  return users.get(email.trim().toLowerCase());
}

export function findUserByIin(iin: string) {
  return [...users.values()].find((user) => user.iin === iin);
}

export function createUser(input: Omit<MockUser, 'id' | 'role' | 'createdAt'>): MockUser {
  const user: MockUser = {
    ...input,
    email: input.email.trim().toLowerCase(),
    id: crypto.randomUUID(),
    role: 'APPLICANT',
    createdAt: new Date().toISOString(),
  };
  users.set(user.email, user);
  return user;
}

export function createSession(userId: string): MockSession {
  writeSessionMarker(userId);
  const now = Date.now();
  const session: MockSession = {
    id: crypto.randomUUID(),
    userId,
    csrfToken: crypto.randomUUID(),
    accessExpiresAt: now + ACCESS_TTL_MS,
    refreshExpiresAt: now + REFRESH_TTL_MS,
  };
  sessions.set(session.id, session);
  return session;
}

export function findSession(sessionId: string | undefined): MockSession | undefined {
  if (!sessionId) return undefined;
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (Date.now() > session.refreshExpiresAt) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session;
}

export function getUserById(userId: string) {
  return [...users.values()].find((user) => user.id === userId);
}

/** Rotates a refresh session: old id stops working, a new one replaces it. */
export function rotateSession(sessionId: string): MockSession | undefined {
  const current = sessions.get(sessionId);
  if (!current) return undefined;
  sessions.delete(sessionId);
  const next = createSession(current.userId);
  return next;
}

export function revokeAllSessionsForUser(userId: string) {
  clearSessionMarker();
  for (const [id, session] of sessions) {
    if (session.userId === userId) sessions.delete(id);
  }
}

/** Simple sliding-window limiter keyed by a normalized identifier (email). */
export function recordAttempt(key: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const existing = (attempts.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
  existing.push(now);
  attempts.set(key, existing);

  if (existing.length > RATE_LIMIT_MAX_ATTEMPTS) {
    const oldest = existing[0];
    const retryAfterSeconds = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { limited: true, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

export function resetAttempts(key: string) {
  attempts.delete(key);
}
