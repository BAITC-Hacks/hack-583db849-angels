'use client';

import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AppHeader } from '../../../../components/applicant/AppHeader';
import { JourneyRail } from '../../../../components/applicant/JourneyRail';
import { StateCard } from '../../../../components/applicant/StateCard';
import { ProtectedRoute } from '../../../../components/ProtectedRoute';
import { Button } from '../../../../components/ui/Button';
import { errorText } from '../../../../lib/api/errors';
import { useAuth } from '../../../../lib/auth/AuthContext';
import { continueAs, sendApplication } from '../../../../lib/stand/handoff';
import { findSubmission, railProgress, readiness } from '../../../../mocks/platformExport';

const primary =
  'inline-flex items-center rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim';

const NEXT_STEPS = [
  'A short work situation in English, spoken — about 8 minutes',
  'One question about your own application, answered on camera',
  'A 1–3 minute video about you',
  'A live interview on video, at a time you choose',
];

/**
 * Where inVision's platform hands an application to the AI layer. On submit
 * the platform — the mock world, in the demo — sends the applicant's profile
 * and answers to `POST /v1/candidates`, exactly as inVision's backend would;
 * the API keeps the profile, strips it before any model, and starts the
 * brief. The applicant then continues in the AI layer as that candidate.
 */
function SubmitScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const key = useRef<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(() => (user ? (findSubmission(user.id)?.candidateId ?? null) : null));

  if (!user) return null;
  const state = readiness(user.id);

  const send = async () => {
    setSending(true);
    setError(null);
    // One key per attempt: "Send" again after a failure repeats the same request.
    key.current ??= crypto.randomUUID();
    try {
      setSent(await sendApplication(user.id, key.current));
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <StateCard
        eyebrow="Submission"
        title="Your application is sent"
        action={
          <button
            type="button"
            className={primary}
            onClick={() => {
              continueAs(sent);
              router.push('/candidate');
            }}
          >
            Continue to your inVision U steps
          </button>
        }
      >
        <p>inVision U has your answers. Four steps remain, each in English, and you can do them in any order:</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {NEXT_STEPS.map((step) => (
            <li key={step} className="flex items-start gap-2">
              <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              {step}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">People make every decision about your application.</p>
      </StateCard>
    );
  }

  return (
    <StateCard
      eyebrow="Submission"
      title="Send your application"
      action={
        <Button type="button" loading={sending} disabled={!state.ready} onClick={() => void send()}>
          Send my application
        </Button>
      }
    >
      <p>Once it is sent, the answers can no longer be changed.</p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        <li className="flex items-start gap-2">
          {state.missing.length === 0 ? (
            <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
          ) : (
            <ExclamationCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
          )}
          <span>
            {state.missing.length === 0 ? (
              'Every required question is answered'
            ) : (
              <>
                Still to answer: {state.missing.join('; ')}.{' '}
                <Link href="/stand/application" className="font-semibold text-brand-ink hover:underline">
                  Back to the application
                </Link>
              </>
            )}
          </span>
        </li>
        <li className="flex items-start gap-2">
          {state.testComplete ? (
            <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
          ) : (
            <ExclamationCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
          )}
          <span>
            {state.testComplete ? (
              'The test is done'
            ) : (
              <>
                The test is not finished.{' '}
                <Link href="/stand/application/test" className="font-semibold text-brand-ink hover:underline">
                  Go to the test
                </Link>
              </>
            )}
          </span>
        </li>
      </ul>
      {error ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-text-primary">
          {error}
        </p>
      ) : null}
    </StateCard>
  );
}

/** The rail reads the same tab memory the submission does, so both say the same about the form and the test. */
function Rail() {
  const { user } = useAuth();
  return <JourneyRail progress={user ? railProgress(user.id) : undefined} />;
}

export default function SubmitPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <Rail />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
        <SubmitScreen />
      </main>
    </ProtectedRoute>
  );
}
