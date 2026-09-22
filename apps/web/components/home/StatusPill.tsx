import { CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export type Tone = 'done' | 'active' | 'waiting' | 'locked' | 'muted';

const tones: Record<Tone, string> = {
  done: 'border-brand-ink/30 bg-brand-soft text-brand-ink',
  active: 'border-status-evidence/40 bg-chip-review text-status-evidence',
  waiting: 'border-border-subtle bg-bg-elevated text-text-secondary',
  locked: 'border-border-subtle bg-bg-elevated text-text-muted',
  muted: 'border-transparent text-text-muted',
};

/** One step's state, in words, never as a score. */
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.72rem] font-medium whitespace-nowrap ${tones[tone]}`}>
      {tone === 'done' ? <CheckIcon aria-hidden="true" className="h-3 w-3" /> : null}
      {tone === 'locked' ? <LockClosedIcon aria-hidden="true" className="h-3 w-3" /> : null}
      {tone === 'active' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-evidence" /> : null}
      {children}
    </span>
  );
}
