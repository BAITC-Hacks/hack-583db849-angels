'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { isRetryable } from './errors';

/**
 * One cache for every product screen, with the rules from
 * `docs/INTEGRATION.md`, section 2: short freshness because the demo moves
 * fast, two retries on a network failure or a 5xx, and never a retry on a 4xx —
 * a `409 DRAFT_LOCKED` is an answer, not a hiccup.
 *
 * Mutations are never retried automatically: a "Try again" button sends the
 * same `Idempotency-Key`, so a repeat cannot create a duplicate.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
            retryDelay: (attempt) => (attempt === 0 ? 500 : 1500),
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
