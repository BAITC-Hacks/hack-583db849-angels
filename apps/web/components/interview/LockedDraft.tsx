'use client';

import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useCopy } from '../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: {
    title: 'The AI draft is locked',
    body: 'Score the candidate yourself first. The draft opens only after your scores are saved, so it cannot anchor your judgement.',
    rule: 'A server rule, not a hidden panel: until then the API answers 409 and sends nothing.',
  },
  ru: {
    title: 'Черновик ИИ закрыт',
    body: 'Сначала оцените кандидата сами. Черновик откроется только после сохранения ваших баллов, чтобы он не повлиял на ваше суждение.',
    rule: 'Это правило сервера, а не спрятанная панель: до этого API отвечает 409 и ничего не отдаёт.',
  },
};

export function LockedDraft() {
  const text = useCopy(copy);

  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-border-strong bg-bg-elevated px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-bg-surface">
        <LockClosedIcon aria-hidden="true" className="h-5 w-5 text-text-secondary" />
      </span>
      <h3 className="text-sm font-semibold text-text-primary">{text.title}</h3>
      <p className="max-w-md text-sm text-text-secondary">{text.body}</p>
      <p className="max-w-md font-mono text-[0.68rem] text-text-muted">{text.rule}</p>
    </div>
  );
}
