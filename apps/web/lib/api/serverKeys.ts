import { apiRoleFor, type DemoRole } from '../roles';

/**
 * Server only. The browser never sees an API key: it calls `/api/v1/*` on this
 * app, and the route handler in `app/api/v1/[...path]` adds the key for the
 * role in the cookie. Nothing here may be imported from a component — the
 * boundary test in `tests/apiKeys.test.ts` fails if it is.
 */
const keyVariable = {
  platform: 'WEB_API_KEY_PLATFORM',
  interviewer: 'WEB_API_KEY_INTERVIEWER',
  commission: 'WEB_API_KEY_COMMISSION',
  admin: 'WEB_API_KEY_ADMIN',
} as const;

export function apiKeyFor(role: DemoRole): string {
  return process.env[keyVariable[apiRoleFor[role]]] ?? '';
}

/** Where the API answers. Inside Compose it is `http://api:3001`. */
export function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
}
