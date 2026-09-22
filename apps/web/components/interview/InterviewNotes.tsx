'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';
import type { InterviewNote } from '../../lib/interview/types';

const copy = {
  en: { title: 'Your interview notes', hint: 'The draft quotes these word for word.', note: 'Note' },
  ru: { title: 'Ваши заметки интервью', hint: 'Черновик цитирует их дословно.', note: 'Заметка' },
};

export function InterviewNotes({ notes }: { notes: InterviewNote[] }) {
  const text = useCopy(copy);

  return (
    <section aria-labelledby="notes-title" className="rounded-panel border border-border-subtle bg-bg-surface">
      <header className="border-b border-border-subtle px-5 py-3">
        <h2 id="notes-title" className="text-sm font-semibold text-text-primary">
          {text.title}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.hint}</p>
      </header>
      <ol className="flex flex-col gap-1 p-3">
        {notes.map((note) => (
          <li
            key={note.id}
            id={note.id}
            className="scroll-mt-6 rounded-control px-3 py-2 transition-colors target:bg-chip-review target:ring-1 target:ring-status-evidence"
          >
            <span className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{text.note} {note.id.replace(/^note_/, '')}</span>
            <p className="mt-0.5 text-[0.82rem] leading-relaxed text-text-primary">{note.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
