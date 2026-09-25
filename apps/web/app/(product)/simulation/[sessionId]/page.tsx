'use client';

import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Composer } from '../../../../components/simulation/Composer';
import { ElapsedTime } from '../../../../components/simulation/ElapsedTime';
import { ScenarioPanel } from '../../../../components/simulation/ScenarioPanel';
import { StopControl } from '../../../../components/simulation/StopControl';
import { Transcript } from '../../../../components/simulation/Transcript';
import { VoiceComposer } from '../../../../components/simulation/VoiceComposer';
import { useSimulation } from '../../../../lib/simulation/useSimulation';

/**
 * M2: the candidate leads a work situation in English, turn by turn, out loud.
 * Speaking is the point — a prepared answer cannot be pasted into a microphone
 * — so typing exists only when staff switched it on for this candidate.
 *
 * The candidate sees the conversation and the situation — never a score, a
 * rating or a hint of how they are doing. Candidate screens are English only,
 * whatever language the staff have chosen.
 *
 * `sessionId` is the simulation's id on the API, so a reload continues it.
 */
export default function SimulationPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { scenario, state, status, loadError, inputMode, turnError, canRetry, send, sendVoice, retry, stop, listen } =
    useSimulation(sessionId);
  const finished = state.stage === 'finished';

  if (status !== 'ready' || !scenario) {
    return (
      <main lang="en" className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 px-5">
        {status === 'error' ? (
          <>
            <p className="text-sm font-semibold text-text-primary">This simulation could not be opened.</p>
            <p className="text-sm text-text-secondary">{loadError}</p>
            <Link href="/candidate" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
              <ArrowLeftIcon aria-hidden="true" className="h-3.5 w-3.5" />
              Back to your home
            </Link>
          </>
        ) : (
          <p className="text-sm text-text-muted" aria-live="polite">
            Opening the simulation…
          </p>
        )}
      </main>
    );
  }

  return (
    <div lang="en" className="flex min-h-screen flex-col bg-bg-base">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg-base/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <span className="hidden min-w-0 truncate text-sm font-semibold text-text-primary md:inline">{scenario.title}</span>
          <div className="ml-auto flex items-center gap-3">
            <ElapsedTime running={!finished} />
            {finished ? null : <StopControl onStop={stop} />}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-5 py-6 lg:grid-cols-[1fr_20rem]">
        {/* On a phone the situation comes first: nobody should start talking before reading it. */}
        <h1 className="order-first text-balance-tight text-xl font-extrabold md:hidden">{scenario.title}</h1>

        <section className="flex min-h-0 flex-col gap-4">

          <div className="flex-1">
            <Transcript turns={state.turns} characterName={scenario.character.name} replying={state.replying} onListen={listen} />
          </div>

          {finished ? (
            <div className="rounded-panel border border-border-subtle bg-bg-surface p-5">
              <p className="text-sm font-semibold text-text-primary">
                {state.ending === 'stopped' ? 'You ended the simulation.' : 'The scenario is complete.'}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Thank you. The conversation is saved exactly as it happened. Your developmental feedback — written
                notes, no scores — will be ready after the review.
              </p>
              <Link
                href="/candidate"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
              >
                <ArrowLeftIcon aria-hidden="true" className="h-3.5 w-3.5" />
                Back to your home
              </Link>
            </div>
          ) : (
            <div className="sticky bottom-4 flex flex-col gap-2">
              {turnError ? (
                <p role="alert" className="flex flex-wrap items-center gap-3 rounded-control border border-status-flag/40 bg-bg-surface px-4 py-2.5 text-sm text-text-primary">
                  {turnError}
                  {canRetry ? (
                    <button type="button" onClick={retry} className="font-semibold text-brand-ink hover:underline">
                      Try again
                    </button>
                  ) : null}
                </p>
              ) : null}
              {inputMode === 'text' ? (
                <Composer disabled={finished} waiting={state.replying} onSend={send} />
              ) : (
                <VoiceComposer disabled={finished} waiting={state.replying} onSend={sendVoice} />
              )}
            </div>
          )}
        </section>

        <ScenarioPanel scenario={scenario} state={state} className="order-first lg:order-none" />
      </main>
    </div>
  );
}
