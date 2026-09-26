'use client';

import { ArrowDownIcon, CalendarDaysIcon, CheckIcon, ClockIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import type { WireCandidateProgress } from '../../lib/api/contract';
import { candidateTasks, daysBetween, DECISION_WAIT_WEEKS, type Task } from '../../lib/candidate/journey';
import { dayKey, formatDay, formatTime } from '../../lib/slots/time';
import { useNow } from '../../lib/slots/useNow';

type Progress = WireCandidateProgress;

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Where the candidate's application stands, at a glance: how much of their
 * own part is done, how much of their time it still needs, what to do next,
 * and when to expect an answer. It counts steps, never marks — nothing here
 * says how well anything went.
 */
export function ApplicationProgress({ progress }: { progress: Progress | null | undefined }) {
  const now = useNow(60_000);
  const tasks = candidateTasks(progress);
  const done = tasks.filter((task) => task.state === 'done').length;
  const percent = Math.round((done / tasks.length) * 100);
  const left = tasks.filter((task) => task.state !== 'done').reduce((sum, task) => sum + task.minutes, 0);
  const next = tasks.find((task) => task.state !== 'done') ?? null;
  const slot = progress?.interviewSlot ?? null;
  const booked = slot && (slot.status === 'booked' || slot.status === 'waiting' || slot.status === 'live') ? slot : null;
  const held = slot?.status === 'done';
  // The road as a whole: the candidate's own steps, the interview, then people's review and the decision.
  const ownDone = tasks.filter((task) => task.anchor !== 'step-interview').every((task) => task.state === 'done');
  const road: { name: string; state: 'done' | 'now' | 'later' }[] = [
    { name: 'Application sent', state: 'done' },
    { name: 'Your steps', state: ownDone ? 'done' : 'now' },
    { name: 'Interview', state: held ? 'done' : booked || ownDone ? 'now' : 'later' },
    { name: 'Review by people', state: ownDone && held ? 'now' : 'later' },
    { name: 'Decision', state: 'later' },
  ];

  return (
    <section aria-labelledby="application-progress" className="flex flex-col gap-5 rounded-panel border border-border-subtle bg-bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={RADIUS} fill="none" strokeWidth="8" className="stroke-bg-elevated" />
            <circle
              cx="40"
              cy="40"
              r={RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - done / tasks.length)}
              className="stroke-brand-green transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <span className="text-xl font-extrabold tabular-nums text-text-primary">{percent}%</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="application-progress" className="text-lg font-bold text-text-primary">
            {done === tasks.length ? 'Your part is done' : `Your application is ${percent}% complete`}
          </h2>
          <p className="text-sm text-text-secondary">
            {done} of {tasks.length} steps done
            {left > 0 ? ` · about ${left} minutes of your time left` : ' · nothing more to do for now'}
          </p>
          <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 sm:gap-1.5" aria-label="Your steps">
            {tasks.map((task) => (
              <TaskBar key={task.anchor} task={task} />
            ))}
          </ol>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile icon={ArrowDownIcon} label="Next step">
          {next ? (
            <>
              <p className="font-semibold text-text-primary">{next.title}</p>
              <a href={`#${next.anchor}`} className="text-[0.8rem] font-semibold text-brand-ink hover:underline">
                Go to this step
              </a>
            </>
          ) : (
            <p className="font-semibold text-text-primary">Nothing — the admissions team takes it from here</p>
          )}
        </Tile>
        <Tile icon={CalendarDaysIcon} label="Your interview">
          {booked ? (
            <>
              <p className="font-semibold text-text-primary">
                {formatDay(booked.startsAt, 'en')}, {formatTime(booked.startsAt, 'en')}
              </p>
              <p className="text-[0.8rem] text-text-secondary">{inDays(daysBetween(dayKey(new Date(now).toISOString()), dayKey(booked.startsAt)))} · Almaty time (UTC+5)</p>
            </>
          ) : held ? (
            <p className="font-semibold text-text-primary">Done — thank you</p>
          ) : (
            <>
              <p className="font-semibold text-text-primary">Not booked yet</p>
              <p className="text-[0.8rem] text-text-secondary">Choose a time that suits you</p>
            </>
          )}
        </Tile>
        <Tile icon={EnvelopeIcon} label="When you hear from us">
          <p className="font-semibold text-text-primary">
            {held ? `Within about ${DECISION_WAIT_WEEKS} weeks` : `About ${DECISION_WAIT_WEEKS} weeks after your interview`}
          </p>
          <p className="text-[0.8rem] text-text-secondary">People review everything together; we write to you either way.</p>
        </Tile>
      </div>

      <ol aria-label="How admission goes" className="grid grid-cols-5 gap-1 text-center">
        {road.map(({ name, state }, index) => (
          <li key={name} className="relative flex flex-col items-center gap-1.5">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`absolute top-3 right-1/2 h-0.5 w-full ${state === 'later' ? 'bg-border-subtle' : 'bg-brand-green'}`}
              />
            ) : null}
            <span
              className={`relative grid h-6 w-6 place-items-center rounded-full text-[0.7rem] font-bold ${
                state === 'done'
                  ? 'bg-brand-green text-on-brand'
                  : state === 'now'
                    ? 'border-2 border-brand-green bg-bg-surface text-text-primary'
                    : 'border border-border-strong bg-bg-surface text-text-muted'
              }`}
            >
              {state === 'done' ? <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={`text-[0.68rem] leading-tight sm:text-[0.75rem] ${state === 'later' ? 'text-text-muted' : 'font-semibold text-text-primary'}`}>
              {name}
              <span className="sr-only">{state === 'done' ? ' — done' : state === 'now' ? ' — now' : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TaskBar({ task }: { task: Task }) {
  return (
    <li className="flex flex-col gap-1">
      <span
        aria-hidden="true"
        className={`h-2 rounded-full ${
          task.state === 'done'
            ? 'bg-brand-green'
            : task.state === 'started'
              ? 'bg-[repeating-linear-gradient(135deg,var(--color-brand-green)_0_4px,transparent_4px_8px)] ring-1 ring-brand-green/60'
              : 'bg-bg-elevated'
        }`}
      />
      <span className="flex items-center gap-1 truncate text-[0.68rem] text-text-muted">
        {task.state === 'done' ? <CheckIcon aria-hidden="true" className="h-3 w-3 text-brand-ink" /> : <ClockIcon aria-hidden="true" className="h-3 w-3" />}
        {task.title}
        <span className="sr-only">{task.state === 'done' ? ' — done' : task.state === 'started' ? ' — started' : ' — to do'}</span>
      </span>
    </li>
  );
}

function Tile({ icon: Icon, label, children }: { icon: typeof ClockIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-control border border-border-subtle bg-bg-elevated/60 p-4">
      <p className="flex items-center gap-1.5 font-mono text-[0.58rem] tracking-[0.14em] text-text-muted uppercase">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </p>
      {children}
    </div>
  );
}

function inDays(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}
