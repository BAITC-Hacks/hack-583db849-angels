import { ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

/** The one thing this role should do next, worked out from where the demo stands. */
export function NextStep({
  label,
  title,
  body,
  href,
  action,
}: {
  label: string;
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-brand-ink/25 bg-brand-soft/60 p-5">
      <div className="flex max-w-2xl flex-col gap-1">
        <p className="font-mono text-[0.6rem] tracking-[0.14em] text-brand-ink uppercase">{label}</p>
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary">{body}</p>
      </div>
      {href && action ? (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 rounded-control bg-brand-green px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
        >
          {action}
          <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </section>
  );
}
