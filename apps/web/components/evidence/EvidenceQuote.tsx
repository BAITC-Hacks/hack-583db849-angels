'use client';

import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { StaffLocale } from '../../lib/i18n/staffLocale';

export type EvidenceSourceKind = 'simulation_turn' | 'application_field' | 'test_item' | 'interview_note';

export interface EvidenceSource {
  kind: EvidenceSourceKind;
  /** A turn id (`turn_04`), a form field id, a test item id or an interview note id. */
  id: string;
}

/** How a source is named on screen: short enough for a chip, exact enough to find. */
const sourceWords: Record<StaffLocale, Record<EvidenceSourceKind, string>> = {
  en: { simulation_turn: 'Turn', application_field: 'Application', test_item: 'Test', interview_note: 'Interview note' },
  ru: { simulation_turn: 'Ход', application_field: 'Анкета', test_item: 'Тест', interview_note: 'Заметка интервью' },
};

const contextLink: Record<StaffLocale, string> = { en: 'Show in context', ru: 'Показать в контексте' };

export function sourceLabel(source: EvidenceSource, locale: StaffLocale = 'en'): string {
  const word = sourceWords[locale][source.kind];
  if (source.kind === 'simulation_turn') return `${word} ${source.id.replace(/^turn_/, '')}`;
  if (source.kind === 'interview_note') return `${word} ${source.id.replace(/^note_/, '')}`;
  return `${word} · ${source.id}`;
}

/**
 * A verbatim quote and where it came from.
 *
 * The quote is shown exactly as the service returned it — the service has
 * already checked it word for word against its source — and a turn links back
 * to its place in the transcript. It is never translated: in a Russian
 * interface it still reads as the candidate wrote or said it.
 */
export function EvidenceQuote({ quote, source, href }: { quote: string; source: EvidenceSource; href?: string }) {
  const { locale } = useStaffLocale();
  const target = href ?? (source.kind === 'simulation_turn' ? `#${source.id}` : undefined);

  return (
    <figure className="flex flex-col gap-1.5 border-l-2 border-status-evidence py-0.5 pl-3">
      <blockquote lang="en" className="text-sm text-text-primary">“{quote}”</blockquote>
      <figcaption className="flex items-center gap-3">
        <span className="font-mono text-[0.62rem] tracking-wide text-status-evidence uppercase">{sourceLabel(source, locale)}</span>
        {target ? (
          <a
            href={target}
            className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-text-secondary hover:text-text-primary hover:underline"
          >
            <ArrowUturnLeftIcon aria-hidden="true" className="h-3 w-3" />
            {contextLink[locale]}
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
