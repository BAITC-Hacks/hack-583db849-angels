'use client';

import { AppHeader } from '../../../components/applicant/AppHeader';
import { JourneyRail } from '../../../components/applicant/JourneyRail';
import { QuestionField } from '../../../components/applicant/QuestionField';
import { StateCard } from '../../../components/applicant/StateCard';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { useDraft } from '../../../lib/application/useDraft';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function SaveStatus({ state }: { state: ReturnType<typeof useDraft>['save'] }) {

  if (state.kind === 'saving') return <span className="text-text-secondary">Saving…</span>;
  if (state.kind === 'unsaved') return <span className="text-text-secondary">There are unsaved changes</span>;
  if (state.kind === 'saved') return <span className="text-brand-ink">All changes saved</span>;
  return <span className="text-text-muted">Answers are saved automatically</span>;
}

/**
 * Leaves the form for the test, but only once the draft is actually saved.
 *
 * The specification (section 6) is explicit about the order: flush the pending
 * autosave, wait for it, and navigate on success alone. A conflict, a rejected
 * field, an expired session or a dropped connection keeps the applicant here,
 * where the alert that explains it already is. An empty draft is allowed
 * through — S2 answers are optional, and S5 owns completeness.
 */
function ContinueToTest({ draft }: { draft: ReturnType<typeof useDraft> }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  return (
    <Button
      type="button"
      loading={leaving}
      onClick={() => {
        setLeaving(true);
        void draft.flushPending().then((saved) => {
          if (saved) router.push('/stand/application/test');
          else setLeaving(false);
        });
      }}
    >
      Continue to the test
    </Button>
  );
}

function DraftForm({ draft: state }: { draft: ReturnType<typeof useDraft> }) {
  const { load, answers, save, change, saveNow, reload } = state;

  if (load.kind === 'loading') {
    return (
      <div className="rounded-panel border border-border-subtle bg-bg-surface p-6">
        <p className="text-sm text-text-secondary">Loading your application…</p>
      </div>
    );
  }

  if (load.kind === 'missing') {
    return (
      <StateCard
        eyebrow="Application"
        title="The application has not been started"
        action={
          <Link
            href="/stand"
            className="inline-flex items-center rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
          >
            Go home
          </Link>
        }
      >
        <p>Start it from the home screen — that is also where you can see whether admissions are open.</p>
      </StateCard>
    );
  }

  if (load.kind === 'session-expired') {
    return (
      <StateCard
        eyebrow="Session"
        title="Your session has expired"
        action={
          <Link
            href="/stand/login"
            className="inline-flex items-center rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
          >
            Sign in again
          </Link>
        }
      >
        <p>Sign in again — the answers you saved stay where they are.</p>
      </StateCard>
    );
  }

  if (load.kind === 'forbidden') {
    return (
      <StateCard eyebrow="Access" title="This area is for applicants only">
        <p>Your account does not submit an application. Staff work in the AI layer: briefs, interviews and the commission’s review are there.</p>
      </StateCard>
    );
  }

  if (load.kind === 'failed') {
    return (
      <StateCard
        eyebrow="Error"
        title="Could not load the data"
        action={
          <Button type="button" onClick={() => void reload()}>
            Try again
          </Button>
        }
      >
        <p>{load.message}</p>
      </StateCard>
    );
  }

  const { draft } = load;
  const answered = Object.keys(answers).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Application</p>
          <h1 className="mt-2 text-balance-tight text-2xl font-extrabold sm:text-3xl">{draft.formVersion.title}</h1>
          {draft.formVersion.description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{draft.formVersion.description}</p>
          ) : null}
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">Answered</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-text-primary">
              {answered} / {draft.formVersion.questions.length}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">Form version</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-text-primary">{draft.formVersion.version}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">Saves</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-text-primary">{draft.revision}</dd>
          </div>
        </dl>
      </div>

      {save.kind === 'conflict' ? (
        <Alert variant="info">The application was changed somewhere else — possibly in another tab. We loaded the last saved version without overwriting anything. Check your answers and make the edit again if you need to.</Alert>
      ) : null}

      {save.kind === 'field-error' ? <Alert>That answer did not fit. Correct it — the other answers are saved.</Alert> : null}
      {save.kind === 'failed' ? <Alert>{save.message}</Alert> : null}

      <form className="overflow-hidden rounded-panel border border-border-subtle bg-bg-surface" noValidate>
        {draft.formVersion.questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            value={answers[question.id]}
            invalid={save.kind === 'field-error' && save.questionId === question.id}
            onChange={(value) => change(question.id, value)}
            onCommit={saveNow}
          />
        ))}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <SaveStatus state={save} />
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={saveNow} disabled={save.kind === 'saving'}>
            Save now
          </Button>
          <ContinueToTest draft={state} />
        </div>
      </div>

      <p className="border-l-2 border-border-strong pl-3 text-xs text-text-muted">
        Every field is optional: the application can be filled in piece by piece and returned to. Completeness is checked later, at submission. Answers are kept on the server and never in the browser.
      </p>
    </>
  );
}

/**
 * The hook lives here rather than inside the form so the rail and the form read
 * the same draft. Calling it twice would mean two loads and two versions of the
 * truth about how much is answered.
 */
function DraftScreen() {
  const draft = useDraft();
  const total = draft.load.kind === 'ready' ? draft.load.draft.formVersion.questions.length : 0;

  return (
    <>
      <JourneyRail
        progress={{
          application: {
            started: draft.load.kind === 'ready',
            answered: Object.keys(draft.answers).length,
            total,
          },
        }}
      />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
        <DraftForm draft={draft} />
      </main>
    </>
  );
}

export default function ApplicationPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <DraftScreen />
    </ProtectedRoute>
  );
}
