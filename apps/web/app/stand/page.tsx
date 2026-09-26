import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { HomeSwitch } from '../../components/applicant/HomeSwitch';
import { DotField } from '../../components/ui/DotField';
import { Logo } from '../../components/ui/Logo';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { DEMO_APPLICANT_EMAIL, DEMO_PASSPHRASE, MIDWAY_APPLICANT_EMAIL, READY_APPLICANT_EMAIL } from '../../mocks/accounts';

/**
 * The entrance to the stand: screens that play inVision's own platform —
 * registration, the application form and the test — so the demo has a system
 * to plug into. They are not the product and sit outside the demo flow.
 *
 * Signed in, this is the applicant's home. Signed out, it says what the stand
 * is and how to get in.
 */
export default function StandPage() {
  return (
    <HomeSwitch>
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-bg-base">
        <DotField className="absolute inset-0 h-full w-full" />

        <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <Logo markSize={24} subtitle={false} />
          <ThemeToggle />
        </header>

        <section className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-5 pb-16">
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-text-muted uppercase">Demo stand · inVision platform</p>
          <h1 className="max-w-2xl text-balance-tight text-3xl font-extrabold sm:text-4xl">
            The platform the AI layer plugs into
          </h1>
          <p className="max-w-2xl text-sm text-text-secondary sm:text-base">
            inVision already runs registration, the application form and the test. These screens stand in for them so
            the demo has something to connect to. Everything runs on mock data in this browser tab; a reload starts
            again from the beginning.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/stand/login"
              className="inline-flex items-center rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
            >
              Sign in
            </Link>
            <Link
              href="/stand/register"
              className="inline-flex items-center rounded-control border border-border-strong px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
            >
              Create an account
            </Link>
          </div>

          <dl className="grid max-w-3xl gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'First visit', value: DEMO_APPLICANT_EMAIL },
              { label: 'Halfway through', value: MIDWAY_APPLICANT_EMAIL },
              { label: 'Ready to send', value: READY_APPLICANT_EMAIL },
              { label: 'Passphrase for all', value: DEMO_PASSPHRASE },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-1 bg-bg-surface px-4 py-3">
                <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{row.label}</dt>
                <dd className="font-mono text-[0.75rem] break-all text-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/demo/candidates"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
          >
            <ArrowLeftIcon aria-hidden="true" className="h-3.5 w-3.5" />
            Back to the demo
          </Link>
        </section>
      </main>
    </HomeSwitch>
  );
}
