import type { ReactNode } from 'react';

/**
 * One frame for every non-working state of the applicant area — closed cycle,
 * expired session, wrong role, failure. They look alike on purpose: the state
 * is told by the words, not by a different layout each time.
 */
export function StateCard({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-panel border border-border-subtle bg-bg-surface p-6 sm:p-8">
      <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-balance-tight text-xl font-bold sm:text-2xl">{title}</h2>
      <div className="mt-3 max-w-2xl text-[0.95rem] text-text-secondary">{children}</div>
      {action ? <div className="mt-6 flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}
