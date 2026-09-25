'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StatusPill } from '../../../components/home/StatusPill';
import { useAdminOverview, useAuditEvents, useDemoReset, useRecordedSession, type AuditEvent } from '../../../lib/admin/queries';
import { useCandidates } from '../../../lib/api/candidates';
import { errorText } from '../../../lib/api/errors';
import { useStaffLocale } from '../../../lib/i18n/StaffLocaleProvider';
import type { StaffLocale } from '../../../lib/i18n/staffLocale';
import { navFor } from '../../../lib/navigation';
import { demoRoles, roleMeta } from '../../../lib/roles';

/** Every action the audit log can hold, as a sentence. */
const actions: Record<StaffLocale, Record<AuditEvent['action'], string>> = {
  en: {
    'candidate.created': 'Candidate arrived from the platform',
    'brief.ready': 'Brief is ready',
    'simulation.started': 'Candidate started the simulation',
    'simulation.completed': 'Simulation finished',
    'simulation.stopped': 'Candidate stopped the simulation early',
    'assessment.ready': 'Report and candidate feedback are ready',
    'interview.created': 'Interview started',
    'recording.uploaded': 'Interview recording sent for transcription',
    'transcript.ready': 'Interview transcript is ready',
    'scores.saved': 'Interviewer saved blind scores',
    'draft.created': 'AI draft written',
    'surprise.started': 'Candidate opened the surprise question',
    'surprise.answered': 'Surprise answer transcribed',
    'surprise.video.viewed': 'Staff watched the surprise answer',
    'surprise.video.deleted': 'Surprise video deleted, 30 days after the decision',
    'presentation.submitted': 'Candidate sent the video presentation',
    'presentation.video.viewed': 'Staff watched the video presentation',
    'presentation.video.deleted': 'Presentation video deleted, 30 days after the decision',
    'demo.reset': 'Demo reset',
  },
  ru: {
    'candidate.created': 'Кандидат пришёл с платформы',
    'brief.ready': 'Бриф готов',
    'simulation.started': 'Кандидат начал симуляцию',
    'simulation.completed': 'Симуляция завершена',
    'simulation.stopped': 'Кандидат остановил симуляцию досрочно',
    'assessment.ready': 'Отчёт и отзыв кандидату готовы',
    'interview.created': 'Интервью начато',
    'recording.uploaded': 'Запись интервью отправлена на расшифровку',
    'transcript.ready': 'Расшифровка интервью готова',
    'scores.saved': 'Интервьюер сохранил баллы вслепую',
    'draft.created': 'Черновик ИИ написан',
    'surprise.started': 'Кандидат открыл сюрпризный вопрос',
    'surprise.answered': 'Сюрпризный ответ расшифрован',
    'surprise.video.viewed': 'Сотрудник посмотрел сюрпризный ответ',
    'surprise.video.deleted': 'Видео сюрпризного ответа удалено через 30 дней после решения',
    'presentation.submitted': 'Кандидат отправил видеопрезентацию',
    'presentation.video.viewed': 'Сотрудник посмотрел видеопрезентацию',
    'presentation.video.deleted': 'Видео презентации удалено через 30 дней после решения',
    'demo.reset': 'Демо сброшено',
  },
};

const modules: { code: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'S'; href: string; en: string; ru: string }[] = [
  { code: 'M1', href: '/interviewer/brief', en: 'Interviewer brief', ru: 'Бриф интервьюера' },
  { code: 'M2', href: '/admin/scenarios', en: 'Leadership simulation', ru: 'Симуляция лидерства' },
  { code: 'M3', href: '/commission/simulation-report', en: 'Report and candidate feedback', ru: 'Отчёт и отзыв кандидату' },
  { code: 'M4', href: '/interviewer/interview', en: 'Interview transcript and draft', ru: 'Расшифровка интервью и черновик' },
  { code: 'M5', href: '/commission/quality-guard', en: 'Quality guard', ru: 'Контроль качества' },
  { code: 'S', href: '/interviewer/brief', en: 'Surprise question', ru: 'Сюрпризный вопрос' },
];

const copy = {
  en: {
    eyebrow: 'Admin',
    title: 'System',
    lede: 'Everything the demo is made of, and everything that happened in it.',
    tiles: { ml: 'ML service', calls: 'Live AI calls', budget: 'AI budget', demo: 'Demo mode' },
    mlUp: 'Up',
    mlDown: 'Down',
    replayed: (count: number) => `${count} replayed`,
    demoOn: 'On',
    demoOff: 'Off',
    modulesTitle: 'Modules',
    on: 'On',
    off: 'Off',
    open: 'Open',
    rolesTitle: 'Roles and what they see',
    screens: (count: number) => `${count} screens`,
    logTitle: 'Activity',
    logEmpty: 'Nothing yet. Actions on any screen, in any role, appear here.',
    system: 'system',
    controlsTitle: 'Demo controls',
    controlsOff: 'The demo controls work only with DEMO_MODE=true.',
    reset: 'Reset the demo',
    confirm: 'Reset everything?',
    yes: 'Reset',
    no: 'Cancel',
    recorded: (label: string) => `Finish ${label}’s simulation from the recording`,
    overview: 'Demo overview',
    kit: 'Evidence components',
  },
  ru: {
    eyebrow: 'Админ',
    title: 'Система',
    lede: 'Из чего состоит демо и всё, что в нём произошло.',
    tiles: { ml: 'ML-сервис', calls: 'Живых вызовов ИИ', budget: 'Бюджет ИИ', demo: 'Режим демо' },
    mlUp: 'Работает',
    mlDown: 'Не отвечает',
    replayed: (count: number) => `из записи: ${count}`,
    demoOn: 'Включён',
    demoOff: 'Выключен',
    modulesTitle: 'Модули',
    on: 'Включён',
    off: 'Выключен',
    open: 'Открыть',
    rolesTitle: 'Роли и что они видят',
    screens: (count: number) => `экранов: ${count}`,
    logTitle: 'Журнал',
    logEmpty: 'Пока пусто. Действия на любом экране в любой роли появятся здесь.',
    system: 'система',
    controlsTitle: 'Управление демо',
    controlsOff: 'Управление демо работает только при DEMO_MODE=true.',
    reset: 'Сбросить демо',
    confirm: 'Сбросить всё?',
    yes: 'Сбросить',
    no: 'Отмена',
    recorded: (label: string) => `Завершить симуляцию: ${label}, из записи`,
    overview: 'Обзор демо',
    kit: 'Компоненты доказательств',
  },
};

/** The admin's home, from the API: system state, who sees what, the audit log, and the demo's controls. */
export default function AdminHome() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const overview = useAdminOverview();
  const audit = useAuditEvents();
  const candidates = useCandidates();
  const reset = useDemoReset();
  const recorded = useRecordedSession();
  const [confirming, setConfirming] = useState(false);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'medium' });
  const data = overview.data;
  const states = new Map(data?.modules.map((module) => [module.module, module.state]));
  const unplayed = (candidates.data ?? []).filter((candidate) => /^Candidate [ABC]$/.test(candidate.label) && !candidate.progress?.simulation);

  const tiles = [
    { label: text.tiles.ml, value: data ? (data.ml === 'up' ? text.mlUp : text.mlDown) : '—', note: data?.gatewayMode },
    { label: text.tiles.calls, value: data ? String(data.usage.liveCalls) : '—', note: data ? text.replayed(data.usage.replayedCalls) : undefined },
    { label: text.tiles.budget, value: data ? `$${data.usage.spentUsd.toFixed(2)} / $${data.usage.capUsd.toFixed(0)}` : '—', note: 'BUDGET_USD_CAP' },
    { label: text.tiles.demo, value: data ? (data.demoMode ? text.demoOn : text.demoOff) : '—', note: 'DEMO_MODE' },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </header>

      {overview.isError ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {errorText(overview.error, locale)}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 bg-bg-surface px-5 py-4">
            <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{tile.label}</dt>
            <dd className="font-mono text-2xl font-bold tabular-nums text-text-primary">{tile.value}</dd>
            {tile.note ? <dd className="font-mono text-[0.68rem] text-text-muted">{tile.note}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <section className="rounded-panel border border-border-subtle bg-bg-surface">
            <h2 className="border-b border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary">{text.modulesTitle}</h2>
            <ul className="divide-y divide-border-subtle">
              {modules.map((module) => {
                const on = states.get(module.code) !== 'off';
                return (
                  <li key={module.code} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="flex items-center gap-3">
                      <span className="w-7 font-mono text-[0.75rem] font-bold text-text-primary">{module.code}</span>
                      <span className="text-sm text-text-secondary">{module[locale]}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusPill tone={on ? 'done' : 'locked'}>{on ? text.on : text.off}</StatusPill>
                      <Link href={module.href} className="text-sm font-semibold text-brand-ink hover:underline">
                        {text.open}
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-panel border border-border-subtle bg-bg-surface">
            <h2 className="border-b border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary">{text.rolesTitle}</h2>
            <ul className="divide-y divide-border-subtle">
              {demoRoles.map((role) => (
                <li key={role} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-control font-mono text-[0.6rem] font-bold text-chip-ink ${roleMeta[role].tile}`}>
                      {roleMeta[role].short}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">{roleMeta[role].copy[locale].name}</span>
                      <span className="text-[0.75rem] text-text-muted">{roleMeta[role].copy[locale].caption}</span>
                    </span>
                  </span>
                  <span className="font-mono text-[0.68rem] text-text-muted">{text.screens(navFor(role).length)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-panel border border-border-subtle bg-bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary">{text.controlsTitle}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {data && !data.demoMode ? (
                <p className="text-[0.8rem] text-text-muted">{text.controlsOff}</p>
              ) : (
                <>
                  {confirming ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[0.8rem] text-text-secondary">{text.confirm}</span>
                      <button
                        type="button"
                        disabled={reset.isPending}
                        onClick={() => reset.mutate(undefined, { onSettled: () => setConfirming(false) })}
                        className="rounded-control bg-status-low px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {text.yes}
                      </button>
                      <button type="button" onClick={() => setConfirming(false)} className="rounded-control border border-border-subtle px-3 py-1.5 text-sm">
                        {text.no}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="rounded-control border border-border-subtle px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-bg-elevated"
                    >
                      {text.reset}
                    </button>
                  )}
                  {unplayed.map((candidate) => (
                    <button
                      key={candidate.candidateId}
                      type="button"
                      disabled={recorded.isPending}
                      onClick={() => recorded.mutate(candidate.candidateId)}
                      className="rounded-control border border-border-subtle px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-bg-elevated disabled:opacity-50"
                    >
                      {text.recorded(candidate.label)}
                    </button>
                  ))}
                  {reset.isError || recorded.isError ? (
                    <p role="alert" className="text-[0.8rem] text-text-primary">
                      {errorText(reset.error ?? recorded.error, locale)}
                    </p>
                  ) : null}
                </>
              )}
              <div className="mt-1 flex gap-4 text-sm">
                <Link href="/demo/candidates" className="font-medium text-brand-ink hover:underline">
                  {text.overview}
                </Link>
                <Link href="/demo/kit" className="font-medium text-brand-ink hover:underline">
                  {text.kit}
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-panel border border-border-subtle bg-bg-surface" aria-live="polite">
            <h2 className="border-b border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary">{text.logTitle}</h2>
            {audit.isError ? (
              <p role="alert" className="px-5 py-4 text-[0.8rem] text-text-primary">
                {errorText(audit.error, locale)}
              </p>
            ) : !audit.data?.length ? (
              <p className="px-5 py-4 text-[0.8rem] text-text-muted">{text.logEmpty}</p>
            ) : (
              <ol className="max-h-96 divide-y divide-border-subtle overflow-y-auto">
                {audit.data.map((event) => (
                  <li key={event.eventId} className="flex items-baseline gap-3 px-5 py-2.5">
                    <time className="shrink-0 font-mono text-[0.65rem] tabular-nums text-text-muted">{time.format(new Date(event.at))}</time>
                    <span className="text-[0.82rem] text-text-primary">
                      {actions[locale][event.action]}
                      {event.candidateLabel ? <span className="text-text-muted"> · {event.candidateLabel}</span> : null}
                      <span className="text-text-muted">
                        {' '}
                        · {event.actorRole === 'system' ? text.system : roleMeta[event.actorRole === 'platform' ? 'candidate' : event.actorRole].copy[locale].name}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
