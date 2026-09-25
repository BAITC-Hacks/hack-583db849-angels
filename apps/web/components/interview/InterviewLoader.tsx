'use client';

import Link from 'next/link';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useInterviewRecord } from '../../lib/interview/queries';
import type { InterviewRecord } from '../../lib/interview/types';
import { useInterviewSession } from '../../lib/interview/useInterview';
import { InterviewScreen } from './InterviewScreen';

const copy = {
  en: { loading: 'Opening the interview…', notFound: 'Interview not found.', forbidden: 'This role does not see interviews.', back: 'Back to the interviews' },
  ru: { loading: 'Открываем интервью…', notFound: 'Интервью не найдено.', forbidden: 'Эта роль не видит интервью.', back: 'К интервью' },
};

function Session({ record }: { record: InterviewRecord }) {
  return <InterviewScreen state={useInterviewSession(record)} />;
}

/** M4 for one interview, from the API: the interviewer's own scores first, then the draft and the differences. */
export function InterviewLoader({ interviewId }: { interviewId: string }) {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  const record = useInterviewRecord(interviewId);

  if (record.isPending) {
    return <p className="px-5 py-16 text-center text-sm text-text-muted" aria-live="polite">{text.loading}</p>;
  }
  if (record.isError) {
    const code = record.error instanceof ApiError ? record.error.code : null;
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-16 text-center">
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {code === 'NOT_FOUND' ? text.notFound : code === 'FORBIDDEN' ? text.forbidden : errorText(record.error, locale)}
        </p>
        <Link href="/interviewer/interview" className="text-sm font-semibold text-brand-ink hover:underline">
          {text.back}
        </Link>
      </main>
    );
  }
  return <Session record={record.data} />;
}
