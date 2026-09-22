import Link from 'next/link';
import { DotField } from '../components/ui/DotField';
import { Logo } from '../components/ui/Logo';
import { OrbitGraphic } from '../components/ui/OrbitGraphic';

/** The page for an address that does not exist. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg-base px-6 text-center">
      <DotField className="absolute inset-0 h-full w-full" />

      <Link href="/" className="absolute top-6 left-6">
        <Logo markSize={22} />
      </Link>

      <OrbitGraphic className="relative h-48 w-48 text-text-muted" />

      <p className="relative mt-8 font-mono text-xs tracking-[0.2em] text-text-muted uppercase">404</p>
      <h1 className="relative mt-3 text-balance-tight text-3xl font-extrabold">Page not found</h1>
      <p className="relative mt-2 max-w-sm text-sm text-text-secondary">There is no such page, or it has moved.</p>

      <Link
        href="/"
        className="relative mt-8 inline-flex items-center justify-center rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
      >
        Go to the demo
      </Link>
    </main>
  );
}
