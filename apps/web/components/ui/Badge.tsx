interface BadgeProps {
  tone?: 'neutral' | 'brand';
  dot?: boolean;
  children: React.ReactNode;
}

export function Badge({ tone = 'neutral', dot, children }: BadgeProps) {
  const styles =
    tone === 'brand'
      ? 'border-brand-ink/25 bg-brand-soft text-brand-ink'
      : 'border-border-subtle bg-bg-elevated text-text-secondary';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${styles}`}
    >
      {dot ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green" /> : null}
      {children}
    </span>
  );
}
