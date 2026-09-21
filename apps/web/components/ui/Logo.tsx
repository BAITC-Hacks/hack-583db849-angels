interface LogoProps {
  className?: string;
  markSize?: number;
  subtitle?: boolean;
}

/**
 * The mark repeats app/icon.svg so the favicon and the header agree. The tile
 * stays dark in both themes — that is how it appears in the source brief — and
 * only gains a hairline in dark mode so its edge stays visible on #131313.
 */
export function Logo({ className, markSize = 28, subtitle = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <svg width={markSize} height={markSize} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
        <rect width="64" height="64" rx="16" fill="#131313" stroke="var(--line-strong)" />
        <path
          d="M16 18 L32 46 L48 18"
          stroke="var(--brand)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="text-sm font-semibold tracking-tight text-text-primary">
        inVision U{subtitle ? <span className="font-normal text-text-secondary"> · AI Leader ID</span> : null}
      </span>
    </span>
  );
}
