/**
 * The two synthetic applicants the mock world starts with.
 *
 * Kept apart from db.ts, which seeds its state on import, so a server-rendered
 * page can print the sign-in details without starting the mock world.
 */
export const DEMO_APPLICANT_EMAIL = 'applicant.demo@example.test';
export const MIDWAY_APPLICANT_EMAIL = 'applicant.midway@example.test';
export const DEMO_PASSPHRASE = 'synthetic-demo-passphrase';

/** Fixed so the session marker can still refer to them after a reload. */
export const DEMO_APPLICANT_ID = '77777777-7777-4777-8777-777777777771';
export const MIDWAY_APPLICANT_ID = '77777777-7777-4777-8777-777777777772';
