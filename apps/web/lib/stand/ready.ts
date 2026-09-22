import { getApiMode } from './config';

let pending: Promise<void> | null = null;

/**
 * Resolves once the API is actually callable.
 *
 * In mock mode that means the MSW worker has started, so a caller cannot fire
 * a request into a network the worker has not intercepted yet. In real mode it
 * resolves immediately — nothing may quietly wait on mocks (AGENTS.md, "Mock
 * API rules"). On the server it also resolves immediately, because there is no
 * browser worker to wait for.
 *
 * This replaces gating the whole render tree on the worker: public pages make
 * no API calls and must render server-side, so only the callers wait.
 */
export function whenApiReady(): Promise<void> {
  if (typeof window === 'undefined' || getApiMode() !== 'mock') return Promise.resolve();
  pending ??= import('../../mocks/browser').then(({ startWorkerOnce }) => startWorkerOnce().then(() => undefined));
  return pending;
}
