'use client';

import { useEffect, useState } from 'react';

/** Minutes and seconds since the screen opened; frozen once the simulation ends. */
export function ElapsedTime({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // A simulation runs once and never resumes, so counting from mount is enough.
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <time className="font-mono text-[0.75rem] tabular-nums text-text-secondary" aria-label="Time elapsed">
      {mm}:{ss}
    </time>
  );
}
