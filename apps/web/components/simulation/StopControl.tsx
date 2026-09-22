'use client';

import { useState } from 'react';

/** Stopping is always available and always asks once, because it cannot be undone. */
export function StopControl({ onStop }: { onStop: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center rounded-control border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
      >
        Stop
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Confirm stopping">
      <span className="hidden text-[0.8rem] text-text-secondary sm:inline">End now? You cannot come back to it.</span>
      <button
        type="button"
        onClick={onStop}
        className="inline-flex items-center rounded-control bg-status-low px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        End simulation
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex items-center rounded-control border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated"
      >
        Keep going
      </button>
    </div>
  );
}
