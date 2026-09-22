'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The remaining time on the current block.
 *
 * It counts against the server's deadline, corrected by the offset measured
 * from the last response, and never against the device clock on its own: a
 * clock that is wrong — or moved on purpose — must not be able to buy time.
 * Reloading the page changes nothing either, because the deadline comes back
 * from the server unchanged.
 *
 * Reaching zero does not decide anything. It asks the screen to check with the
 * server, which is the only place a block can actually be recorded as timed
 * out.
 */
export function BlockCountdown({
  expiresAt,
  totalSeconds,
  serverOffsetMs,
  onExpire,
}: {
  expiresAt: string;
  totalSeconds: number;
  serverOffsetMs: number;
  onExpire: () => void;
}) {
  // Only the clock is state; what is left is derived from it on every render,
  // so nothing has to be kept in sync with anything.
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);

  useEffect(() => {
    expired.current = false;

    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (Date.parse(expiresAt) - (current + serverOffsetMs) <= 0 && !expired.current) {
        expired.current = true;
        onExpire();
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [expiresAt, onExpire, serverOffsetMs]);

  const remaining = Math.max(0, Date.parse(expiresAt) - (now + serverOffsetMs));
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const share = totalSeconds > 0 ? Math.min(100, Math.max(0, (remaining / (totalSeconds * 1000)) * 100)) : 0;
  const low = seconds <= 10;

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">Left</span>
      <span
        // Announced on a timer politely, and only every few seconds: a live
        // region that spoke every tick would make the block unusable.
        role="timer"
        aria-live="off"
        className={`font-mono text-sm tabular-nums ${low ? 'text-st-low' : 'text-text-primary'}`}
      >
        {minutes}:{String(rest).padStart(2, '0')}
      </span>
      <span aria-hidden="true" className="h-1 w-28 overflow-hidden rounded-full bg-border-subtle">
        <span
          className={`block h-full rounded-full transition-[width] duration-200 ease-linear ${
            low ? 'bg-st-low' : 'bg-brand-green'
          }`}
          style={{ width: `${share}%` }}
        />
      </span>
    </div>
  );
}
