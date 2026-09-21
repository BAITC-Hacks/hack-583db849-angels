'use client';

import type { CurrentTestBlock, TestAttemptSummary } from '@invision/stand-client';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { BlockCountdown } from './BlockCountdown';

/**
 * One timed block: four statements, one marked as most like the applicant and a
 * different one as least.
 *
 * The two choices are made in one grid rather than in two separate lists, so
 * the applicant compares the four statements once instead of reading them
 * twice. Picking a statement as "most" releases it from "least" automatically —
 * the contract refuses a pair that is the same statement, and a form that lets
 * someone build a refused answer is a form that wastes their remaining seconds.
 *
 * Nothing here shows what a statement is worth or which competency it belongs
 * to. That mapping is private methodology, and the screen is built so there is
 * nowhere for it to appear.
 */
export function ForcedChoiceBlock({
  attempt,
  block,
  serverOffsetMs,
  busy,
  onSubmit,
  onExpire,
}: {
  attempt: TestAttemptSummary;
  block: CurrentTestBlock;
  serverOffsetMs: number;
  busy: boolean;
  onSubmit: (mostStatementId: string, leastStatementId: string) => void;
  onExpire: () => void;
}) {
  // Selections belong to the block they were made in. The screen gives this
  // component the block id as its key, so a new block arrives as a new
  // component with empty state instead of state that has to be cleared.
  const [most, setMost] = useState<string | null>(null);
  const [least, setLeast] = useState<string | null>(null);

  function chooseMost(id: string) {
    setMost(id);
    if (least === id) setLeast(null);
  }

  function chooseLeast(id: string) {
    setLeast(id);
    if (most === id) setMost(null);
  }

  const ready = most !== null && least !== null && most !== least;

  return (
    <section className="rounded-panel border border-border-subtle bg-bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
          {`Block ${block.position} of ${attempt.totalBlocks}`}
        </p>
        <BlockCountdown
          expiresAt={block.expiresAt}
          totalSeconds={block.timeLimitSeconds}
          serverOffsetMs={serverOffsetMs}
          onExpire={onExpire}
        />
      </header>

      <div className="px-5 pt-5">
        <h2 className="text-balance-tight text-lg font-bold sm:text-xl">{block.prompt}</h2>
        <p className="mt-1.5 text-sm text-text-secondary">Pick the one statement most like you, and a different one least like you.</p>
      </div>

      <div role="group" aria-label={block.prompt} className="mt-4">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-y border-border-subtle bg-bg-elevated px-5 py-2">
          <span className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
            Statement
          </span>
          <span className="w-16 text-center font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
            Most
          </span>
          <span className="w-16 text-center font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
            Least
          </span>
        </div>

        {block.statements.map((statement) => (
          <div
            key={statement.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
          >
            <p className="text-[0.95rem] text-text-primary">{statement.text}</p>

            <label className="flex w-16 cursor-pointer justify-center">
              <input
                type="radio"
                name={`most-${block.id}`}
                value={statement.id}
                checked={most === statement.id}
                onChange={() => chooseMost(statement.id)}
                disabled={busy}
                className="sr-only peer"
                aria-label={`Most like me: ${statement.text}`}
              />
              <span className="choice-mark peer-checked:choice-mark-most peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ink" />
            </label>

            <label className="flex w-16 cursor-pointer justify-center">
              <input
                type="radio"
                name={`least-${block.id}`}
                value={statement.id}
                checked={least === statement.id}
                onChange={() => chooseLeast(statement.id)}
                disabled={busy}
                className="sr-only peer"
                aria-label={`Least like me: ${statement.text}`}
              />
              <span className="choice-mark peer-checked:choice-mark-least peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ink" />
            </label>
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-4">
        <p className="font-mono text-[0.6rem] tracking-wide text-text-muted">
          Statements are in English — the language the assessment runs on
        </p>
        <Button
          type="button"
          loading={busy}
          disabled={!ready}
          onClick={() => {
            if (most && least) onSubmit(most, least);
          }}
        >
          Confirm the pair
        </Button>
      </footer>
    </section>
  );
}
