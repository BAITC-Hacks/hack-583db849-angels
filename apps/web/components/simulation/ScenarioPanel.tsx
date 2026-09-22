import type { ScenarioBrief, SimulationState } from '../../lib/simulation/types';

const stageLabel: Record<SimulationState['stage'], string> = {
  opening: 'Opening',
  'in-progress': 'In progress',
  'wrapping-up': 'Wrapping up',
  finished: 'Finished',
};

/**
 * What the candidate needs beside the conversation: the situation, who they are
 * talking to, and the ground rules. Nothing here grades them, and the character's
 * hidden motive stays hidden.
 */
export function ScenarioPanel({
  scenario,
  state,
  className,
}: {
  scenario: ScenarioBrief;
  state: SimulationState;
  className?: string;
}) {
  return (
    <aside className={`flex flex-col gap-4 ${className ?? ''}`}>
      <section className="rounded-panel border border-border-subtle bg-bg-surface p-5">
        <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">The situation</p>
        <p className="mt-2 text-sm text-text-secondary">{scenario.situation}</p>
        <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-3 text-sm">
          <div>
            <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">Your role</dt>
            <dd className="text-text-primary">{scenario.yourRole}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">Your goal</dt>
            <dd className="text-text-primary">{scenario.goal}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-panel border border-border-subtle bg-bg-surface p-5">
        <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Talking to</p>
        <p className="mt-2 text-sm font-semibold text-text-primary">{scenario.character.name}</p>
        <p className="text-sm text-text-secondary">{scenario.character.role}</p>
        <p className="mt-2 text-[0.8rem] text-text-muted">Wants: {scenario.character.wants.toLowerCase()}</p>
      </section>

      <section className="rounded-panel border border-border-subtle bg-bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Progress</p>
          <p className="font-mono text-[0.68rem] tracking-wide text-brand-ink uppercase">{stageLabel[state.stage]}</p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {Array.from({ length: scenario.maxCandidateTurns }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index < state.candidateTurns ? 'bg-brand-green' : 'bg-border-subtle'}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[0.8rem] text-text-muted">
          Your turns: {state.candidateTurns} of about {scenario.maxCandidateTurns} · around {scenario.expectedMinutes}{' '}
          minutes
        </p>
      </section>

      <ul className="flex flex-col gap-1.5 px-1 text-[0.8rem] text-text-muted">
        <li>Answer as you would at work. There are no right answers.</li>
        <li>Grammar mistakes do not count against you.</li>
        <li>You can stop at any moment.</li>
      </ul>
    </aside>
  );
}
