import { cookies } from 'next/headers';
import { proxyToApi } from '../../../../lib/api/proxy';
import { apiBaseUrl, apiKeyFor } from '../../../../lib/api/serverKeys';
import { DEMO_ROLE_COOKIE, readDemoRole } from '../../../../lib/roles';

/**
 * Every call a screen makes goes to `/api/v1/*` on this app, and this handler
 * forwards it to the API with the key of the role in the cookie. The key never
 * reaches the browser, and no CORS is involved.
 */
export const dynamic = 'force-dynamic';

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const role = readDemoRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value);
  return proxyToApi(request, path, { baseUrl: apiBaseUrl(), apiKey: apiKeyFor(role) });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
