'use client';

import { useEffect } from 'react';
import { whenApiReady } from '../lib/stand/ready';

/**
 * Starts the MSW browser worker when NEXT_PUBLIC_API_MODE=mock, and renders
 * its children immediately either way.
 *
 * It deliberately does not gate the tree on the worker: doing so meant the
 * server rendered an empty document and the public pages — which make no API
 * calls at all — stayed blank until a worker booted in the browser. Callers
 * that do touch the API await whenApiReady() instead, so nothing races the
 * worker and real mode still never waits on mocks.
 */
export function MswProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void whenApiReady();
  }, []);

  return <>{children}</>;
}
