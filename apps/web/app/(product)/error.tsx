'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useDemoRole } from '../../lib/DemoRoleProvider';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { homeFor } from '../../lib/roles';

const copy = {
  en: { title: 'This screen hit a problem', body: 'Nothing you entered is lost on the server. Try again, or go back home.', retry: 'Try again', home: 'Back home' },
  ru: { title: 'На этом экране произошла ошибка', body: 'Всё, что уже сохранено на сервере, на месте. Попробуйте ещё раз или вернитесь на главную.', retry: 'Ещё раз', home: 'На главную' },
};

/** Any product screen that throws lands here instead of a blank page. A candidate always reads English. */
export default function ProductError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { role } = useDemoRole();
  const { locale } = useStaffLocale();
  const text = copy[role === 'candidate' ? 'en' : locale];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="text-xl font-bold text-text-primary">{text.title}</h1>
      <p className="text-sm text-text-secondary">{text.body}</p>
      {error.digest ? <p className="font-mono text-[0.68rem] text-text-muted">{error.digest}</p> : null}
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-control bg-brand-green px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
        >
          {text.retry}
        </button>
        <Link
          href={homeFor[role]}
          className="rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
        >
          {text.home}
        </Link>
      </div>
    </main>
  );
}
