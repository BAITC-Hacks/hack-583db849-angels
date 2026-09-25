'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StatusPill, type Tone } from '../../../components/home/StatusPill';
import { resetWorld, useWorld, type DemoEventCode } from '../../../lib/demo/world';
import { useStaffLocale } from '../../../lib/i18n/StaffLocaleProvider';
import type { StaffLocale } from '../../../lib/i18n/staffLocale';
import { navFor } from '../../../lib/navigation';
import { demoRoles, roleMeta } from '../../../lib/roles';

const events: Record<StaffLocale, Record<DemoEventCode, string>> = {
  en: {
    'brief-viewed': 'Interviewer read the brief',
    'simulation-started': 'Candidate started the simulation',
    'simulation-completed': 'Candidate finished the simulation',
    'simulation-stopped': 'Candidate stopped the simulation early',
    'assessment-ready': 'Report and candidate feedback are ready',
    'recording-loaded': 'Interview recording sent for transcription',
    'transcript-ready': 'Interview transcript is ready',
    'scores-saved': 'Interviewer saved blind scores',
    'draft-ready': 'AI draft opened for the interviewer',
    'accommodation-changed': 'Staff changed how a candidate answers',
    'demo-reset': 'Demo reset',
  },
  ru: {
    'brief-viewed': 'Интервьюер прочитал бриф',
    'simulation-started': 'Кандидат начал симуляцию',
    'simulation-completed': 'Кандидат завершил симуляцию',
    'simulation-stopped': 'Кандидат остановил симуляцию досрочно',
    'assessment-ready': 'Отчёт и отзыв кандидату готовы',
    'recording-loaded': 'Запись интервью отправлена на расшифровку',
    'transcript-ready': 'Расшифровка интервью готова',
    'scores-saved': 'Интервьюер сохранил баллы вслепую',
    'draft-ready': 'Черновик ИИ открыт интервьюеру',
    'accommodation-changed': 'Сотрудник изменил способ ответа кандидата',
    'demo-reset': 'Демо сброшено',
  },
};

type ModuleState = 'live' | 'preview' | 'locked';

const modules: { code: string; href?: string; state: ModuleState; en: string; ru: string }[] = [
  { code: 'M1', href: '/interviewer/brief/00000000-0000-4000-8000-00000000000a', state: 'preview', en: 'Interviewer brief', ru: 'Бриф интервьюера' },
  { code: 'M2', href: '/simulation', state: 'live', en: 'Leadership simulation', ru: 'Симуляция лидерства' },
  { code: 'M3', href: '/commission/simulation-report', state: 'live', en: 'Report and candidate feedback', ru: 'Отчёт и отзыв кандидату' },
  { code: 'M4', href: '/interviewer/interview/preview', state: 'preview', en: 'Interview transcript and draft', ru: 'Расшифровка интервью и черновик' },
  { code: 'M5', state: 'locked', en: 'Quality guard', ru: 'Контроль качества' },
];

const copy = {
  en: {
    eyebrow: 'Admin',
    title: 'System',
    lede: 'Everything the demo is made of, and everything that happened in it.',
    tiles: { api: 'API', calls: 'Live AI calls', budget: 'AI budget', modules: 'Modules on preview' },
    apiValue: 'Mock',
    apiNote: 'the real API arrives with F0 (#3)',
    callsNote: 'replay only in the preview',
    modulesTitle: 'Modules',
    state: { live: 'On the API', preview: 'Preview', locked: 'Not built' },
    open: 'Open',
    rolesTitle: 'Roles and what they see',
    screens: (count: number) => `${count} screens`,
    logTitle: 'Activity',
    logEmpty: 'Nothing yet. Actions on any screen, in any role, appear here.',
    controlsTitle: 'Demo controls',
    reset: 'Reset the demo',
    confirm: 'Reset everything?',
    yes: 'Reset',
    no: 'Cancel',
    overview: 'Demo overview',
    kit: 'Evidence components',
  },
  ru: {
    eyebrow: 'Админ',
    title: 'Система',
    lede: 'Из чего состоит демо и всё, что в нём произошло.',
    tiles: { api: 'API', calls: 'Живых вызовов ИИ', budget: 'Бюджет ИИ', modules: 'Модулей на превью' },
    apiValue: 'Моки',
    apiNote: 'настоящий API появится с F0 (#3)',
    callsNote: 'в превью только replay',
    modulesTitle: 'Модули',
    state: { live: 'На API', preview: 'Превью', locked: 'Не готов' },
    open: 'Открыть',
    rolesTitle: 'Роли и что они видят',
    screens: (count: number) => `экранов: ${count}`,
    logTitle: 'Журнал',
    logEmpty: 'Пока пусто. Действия на любом экране в любой роли появятся здесь.',
    controlsTitle: 'Управление демо',
    reset: 'Сбросить демо',
    confirm: 'Сбросить всё?',
    yes: 'Сбросить',
    no: 'Отмена',
    overview: 'Обзор демо',
    kit: 'Компоненты доказательств',
  },
};

/** The admin's home: system state, who sees what, a live activity log, and the demo's controls. */
export default function AdminHome() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const world = useWorld();
  const [confirming, setConfirming] = useState(false);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'medium' });
  const stateTone: Record<ModuleState, Tone> = { live: 'done', preview: 'active', locked: 'locked' };

  const tiles = [
    { label: text.tiles.api, value: text.apiValue, note: text.apiNote },
    { label: text.tiles.calls, value: '0', note: text.callsNote },
    { label: text.tiles.budget, value: '$0.00 / $20', note: 'BUDGET_USD_CAP' },
    { label: text.tiles.modules, value: `${modules.filter((m) => m.state === 'preview').length} / 5` },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </header>

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
              {modules.map((module) => (
                <li key={module.code} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="flex items-center gap-3">
                    <span className="w-7 font-mono text-[0.75rem] font-bold text-text-primary">{module.code}</span>
                    <span className="text-sm text-text-secondary">{module[locale]}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusPill tone={stateTone[module.state]}>{text.state[module.state]}</StatusPill>
                    {module.href ? (
                      <Link href={module.href} className="text-sm font-semibold text-brand-ink hover:underline">
                        {text.open}
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
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
              {confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-[0.8rem] text-text-secondary">{text.confirm}</span>
                  <button
                    type="button"
                    onClick={() => {
                      resetWorld();
                      setConfirming(false);
                    }}
                    className="rounded-control bg-status-low px-3 py-1.5 text-sm font-semibold text-white"
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
            {world.events.length === 0 ? (
              <p className="px-5 py-4 text-[0.8rem] text-text-muted">{text.logEmpty}</p>
            ) : (
              <ol className="max-h-80 divide-y divide-border-subtle overflow-y-auto">
                {world.events.map((event) => (
                  <li key={event.id} className="flex items-baseline gap-3 px-5 py-2.5">
                    <time className="shrink-0 font-mono text-[0.65rem] tabular-nums text-text-muted">{time.format(new Date(event.at))}</time>
                    <span className="text-[0.82rem] text-text-primary">
                      {events[locale][event.code]}
                      {event.candidate ? <span className="text-text-muted"> · {event.candidate}</span> : null}
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
