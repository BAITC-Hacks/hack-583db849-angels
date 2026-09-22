import Link from 'next/link';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

/** Header for the product side of the demo: interviewer and commission screens. */
export function DemoHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link
          href="/demo/candidates"
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"
        >
          <Logo markSize={24} />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/stand"
            className="inline-flex items-center rounded-control border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            Platform stand
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
