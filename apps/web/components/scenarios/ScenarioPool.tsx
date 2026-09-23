'use client';

import { competencyOrder } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { ScenarioSummary } from '../../lib/scenarios/types';

const copy = {
  en: {
    tiles: { ready: 'Ready to assign', drafts: 'Still being written', assigned: 'Times assigned' },
    columns: ['Scenario', 'Status', 'Competencies', 'Times assigned'],
    ready: 'Ready',
    draft: 'Draft',
    pending: 'after the bench',
    never: 'never assigned',
  },
  ru: {
    tiles: { ready: 'Готовы к выдаче', drafts: 'Ещё пишутся', assigned: 'Раз выпадало' },
    columns: ['Сценарий', 'Статус', 'Компетенции', 'Раз выпадал'],
    ready: 'Готов',
    draft: 'Черновик',
    pending: 'после стенда',
    never: 'не выпадал',
  },
};

/**
 * The pool, in the order it will be assigned: ready first, least used at the
 * top, because that is exactly how the next candidate's scenario is picked.
 */
export function ScenarioPool({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  const ready = scenarios.filter((scenario) => scenario.status === 'ready');
  const ordered = [...scenarios].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'ready' ? -1 : 1;
    return left.assignedCount - right.assignedCount;
  });

  const tiles = [
    { label: text.tiles.ready, value: `${ready.length} / ${scenarios.length}` },
    { label: text.tiles.drafts, value: String(scenarios.length - ready.length) },
    { label: text.tiles.assigned, value: String(scenarios.reduce((total, scenario) => total + scenario.assignedCount, 0)) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 bg-bg-surface px-5 py-4">
            <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{tile.label}</dt>
            <dd className="font-mono text-2xl font-bold tabular-nums text-text-primary">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-panel border border-border-subtle bg-bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {text.columns.map((column) => (
                <th key={column} className="px-4 py-2.5 font-mono text-[0.58rem] font-normal tracking-[0.12em] text-text-muted uppercase">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {ordered.map((scenario) => {
              const isReady = scenario.status === 'ready';
              return (
                <tr key={scenario.scenarioId} className={isReady ? '' : 'opacity-70'}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{scenario.title}</p>
                    <p className="font-mono text-[0.62rem] text-text-muted">{scenario.scenarioId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-control px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.1em] uppercase ${
                        isReady ? 'bg-brand-soft text-text-primary' : 'bg-bg-elevated text-text-muted'
                      }`}
                    >
                      {isReady ? text.ready : text.draft}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex gap-1 font-mono text-[0.68rem]">
                      {competencyOrder.map((competency) => (
                        <span
                          key={competency}
                          className={scenario.competencies.includes(competency) ? 'text-text-primary' : 'text-text-muted opacity-40'}
                        >
                          {competency}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-text-secondary">
                    {isReady ? scenario.assignedCount : <span className="text-text-muted">{text.pending}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
