import { setupWorker } from 'msw/browser';
import { clearSessionCookies, handlers, restoreMarkedSession } from './handlers';
import { s2Handlers } from './s2Handlers';
import { s3Handlers } from './s3Handlers';
import { purgeLegacyMockStorage } from './db';
import { seedDemoJourney } from './seed';

export const worker = setupWorker(...handlers, ...s2Handlers, ...s3Handlers);

// React 19 dev/StrictMode double-invokes effects; msw's worker throws if
// start() is called a second time on an already-enabled network, so this
// module-level guard makes MswProvider's effect idempotent.
let startPromise: ReturnType<typeof worker.start> | null = null;

export function startWorkerOnce(): ReturnType<typeof worker.start> {
  if (!startPromise) {
    // Mock users and sessions live in memory only, so a cookie left over from a
    // previous page load points at a session that no longer exists. Clearing it
    // here makes the signed-out state after a reload explicit rather than
    // something the caller discovers through a failed request.
    purgeLegacyMockStorage();
    clearSessionCookies();

    // Seeded in the browser only. The tests want an empty world they fill
    // themselves, and a fixture that arrived pre-populated would hide the
    // difference between what a handler did and what the seed had already done.
    seedDemoJourney();

    // …and the account that was signed in comes back, which is what lets
    // somebody change the interface language without being thrown out of their
    // own cabinet.
    restoreMarkedSession();

    startPromise = worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
  return startPromise;
}
