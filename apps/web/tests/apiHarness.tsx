import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

/**
 * A fake of our own `/api/v1` for screen tests: answers by method and path,
 * and keeps every call so a test can check what a screen sent.
 */
export interface Call {
  method: string;
  path: string;
  headers: Headers;
  body: string | FormData | null;
}

export type Handler = (call: Call) => Response;

export const examples = join(process.cwd(), '../../docs/contracts/examples/candidate-a');

export function example<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(examples, name), 'utf8')) as T;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function apiError(status: number, code: string, details?: Record<string, unknown>): Response {
  return json({ error: { code, message: code, details: details ?? {}, traceId: 'test' } }, status);
}

export function mockApi(routes: Record<string, Handler>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(request ? request.url : String(input), 'http://localhost');
      const method = (request?.method ?? init?.method ?? 'GET').toUpperCase();
      const headers = new Headers(request ? request.headers : init?.headers);
      const body = init?.body instanceof FormData ? init.body : request ? await request.clone().text() : ((init?.body as string) ?? null);
      const call: Call = { method, path: url.pathname + url.search, headers, body: body || null };
      calls.push(call);
      const route = Object.keys(routes).find((key) => {
        const [routeMethod, routePath] = key.split(' ');
        return routeMethod === method && new RegExp(`^${routePath}$`).test(url.pathname);
      });
      if (!route) return apiError(404, 'NOT_FOUND');
      return routes[route](call);
    }),
  );
  return calls;
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function withQuery(ui: ReactNode) {
  return render(<QueryClientProvider client={client()}>{ui}</QueryClientProvider>);
}

export function hookWithQuery<T>(hook: () => T) {
  const shared = client();
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={shared}>{children}</QueryClientProvider>,
  });
}
