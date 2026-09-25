import { BrandMark } from './BrandMark';

interface LogoProps {
  className?: string;
  markSize?: number;
  subtitle?: boolean;
}

/**
 * The pixel "U" mark (BrandMark) and the name. The tile stays dark in both
 * themes and only gains a hairline in dark mode so its edge stays visible on
 * #131313.
 */
export function Logo({ className, markSize = 28, subtitle = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <BrandMark size={markSize} />
      <span className="text-sm font-semibold tracking-tight text-text-primary">
        inVision U{subtitle ? <span className="font-normal text-text-secondary"> · AI Leader ID</span> : null}
      </span>
    </span>
  );
}
