'use client';

import Link from 'next/link';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useAssessment, useFeedback } from '../../lib/report/queries';
import { FeedbackView } from './FeedbackView';
import { SimulationReportView } from './SimulationReportView';

const staffCopy = {
  en: {
    loading: 'Opening the report…',
    forbidden: 'This role does not see the report.',
    notFound: 'Report not found.',
    back: 'Back to candidates',
  },
  ru: {
    loading: 'Открываем отчёт…',
    forbidden: 'Эта роль не видит отчёт.',
    notFound: 'Отчёт не найден.',
    back: 'К кандидатам',
  },
};

function Notice({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-16 text-center">{children}</main>;
}

/** The commission report for one assessment, straight from the API. */
export function ReportScreen({ assessmentId }: { assessmentId: string }) {
  const text = useCopy(staffCopy);
  const { locale } = useStaffLocale();
  const report = useAssessment(assessmentId);

  if (report.isPending) return <Notice><p className="text-sm text-text-muted" aria-live="polite">{text.loading}</p></Notice>;
  if (report.isError) {
    const code = report.error instanceof ApiError ? report.error.code : null;
    const message = code === 'FORBIDDEN' ? text.forbidden : code === 'NOT_FOUND' ? text.notFound : errorText(report.error, locale);
    return (
      <Notice>
        <p role="alert" className="text-sm font-semibold text-text-primary">{message}</p>
        <Link href="/commission" className="text-sm font-semibold text-brand-ink hover:underline">
          {text.back}
        </Link>
      </Notice>
    );
  }
  return <SimulationReportView report={report.data} />;
}

/**
 * What the candidate receives after the simulation, relayed through inVision.
 * English only, and it carries no score of any kind.
 */
export function FeedbackScreen({ assessmentId }: { assessmentId: string }) {
  const feedback = useFeedback(assessmentId);

  if (feedback.isPending) {
    return (
      <Notice>
        <p lang="en" className="text-sm text-text-muted" aria-live="polite">
          Opening your feedback…
        </p>
      </Notice>
    );
  }
  if (feedback.isError) {
    return (
      <Notice>
        <div lang="en" className="flex flex-col gap-3">
          <h1 className="text-xl font-bold text-text-primary">Your feedback is not ready yet</h1>
          <p className="text-sm text-text-secondary">It is written after you finish the simulation and it has been reviewed.</p>
          <Link href="/candidate" className="mx-auto mt-2 text-sm font-semibold text-brand-ink hover:underline">
            Back to your home
          </Link>
        </div>
      </Notice>
    );
  }
  return (
    <div lang="en">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Your feedback</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">What stood out in your simulation</h1>
          <p className="text-sm text-text-secondary">
            Scenario: {feedback.data.scenarioTitle}. These notes are about how you led the conversation — not about your
            English.
          </p>
        </header>
        <FeedbackView feedback={feedback.data} />
      </main>
    </div>
  );
}
