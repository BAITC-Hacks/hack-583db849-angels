import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness of the web app itself, for Docker and Compose health checks.
 *
 * It says only that this server answers. Whether the API is up is the API's own
 * health endpoint to report; folding it in here would mark the web container
 * unhealthy whenever the API restarts, and in mock mode there is no API at all.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
