'use client';

import { useEffect, useRef } from 'react';
import type { SimulationTurn } from '../../lib/simulation/types';

/**
 * The conversation as it happens. Each turn carries its id in the DOM so the
 * commission report can link a quote straight back to it later.
 */
export function Transcript({
  turns,
  characterName,
  replying,
}: {
  turns: SimulationTurn[];
  characterName: string;
  replying: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Follow new turns, but not on arrival: the page opens at the top, where the
  // situation is, rather than jumping past it.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, replying]);

  return (
    <div role="log" aria-live="polite" aria-label="Conversation" className="flex flex-col gap-4">
      {turns.map((turn) => {
        const mine = turn.speaker === 'candidate';
        return (
          <div key={turn.turnId} id={turn.turnId} className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
            <span className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
              {mine ? 'You' : characterName}
            </span>
            <p
              className={`max-w-[34rem] rounded-panel px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                mine
                  ? 'bg-brand-soft text-text-primary'
                  : 'border border-border-subtle bg-bg-surface text-text-primary'
              }`}
            >
              {turn.text}
            </p>
          </div>
        );
      })}

      {replying ? (
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{characterName}</span>
          <p className="inline-flex items-center gap-2 rounded-panel border border-border-subtle bg-bg-surface px-4 py-3 text-sm text-text-muted">
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:300ms]" />
            </span>
            {characterName} is replying
          </p>
        </div>
      ) : null}

      <div ref={end} />
    </div>
  );
}
