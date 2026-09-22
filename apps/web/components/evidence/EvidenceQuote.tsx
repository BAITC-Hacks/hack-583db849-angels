import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

export type EvidenceSourceKind = 'simulation_turn' | 'application_field' | 'test_item' | 'interview_note';

export interface EvidenceSource {
  kind: EvidenceSourceKind;
  /** A turn id (`turn_04`), a form field id, a test item id or an interview note id. */
  id: string;
}

/** How a source is named on screen: short enough for a chip, exact enough to find. */
export function sourceLabel(source: EvidenceSource): string {
  switch (source.kind) {
    case 'simulation_turn':
      return `Turn ${source.id.replace(/^turn_/, '')}`;
    case 'application_field':
      return `Application · ${source.id}`;
    case 'test_item':
      return `Test · ${source.id}`;
    case 'interview_note':
      return `Interview note · ${source.id}`;
  }
}

/**
 * A verbatim quote and where it came from.
 *
 * The quote is shown exactly as the service returned it — the service has
 * already checked it word for word against its source — and a turn links back
 * to its place in the transcript.
 */
export function EvidenceQuote({ quote, source, href }: { quote: string; source: EvidenceSource; href?: string }) {
  const target = href ?? (source.kind === 'simulation_turn' ? `#${source.id}` : undefined);

  return (
    <figure className="flex flex-col gap-1.5 border-l-2 border-status-evidence py-0.5 pl-3">
      <blockquote className="text-sm text-text-primary">“{quote}”</blockquote>
      <figcaption className="flex items-center gap-3">
        <span className="font-mono text-[0.62rem] tracking-wide text-status-evidence uppercase">{sourceLabel(source)}</span>
        {target ? (
          <a
            href={target}
            className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-text-secondary hover:text-text-primary hover:underline"
          >
            <ArrowUturnLeftIcon aria-hidden="true" className="h-3 w-3" />
            Show in context
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
