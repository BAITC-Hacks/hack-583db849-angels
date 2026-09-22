'use client';

import type { StaffLocale } from '../../lib/i18n/staffLocale';

const options: { value: StaffLocale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ru', label: 'RU' },
];

/** English or Russian for staff screens. Candidate screens never show it. */
export function LanguageSwitch({ locale, onChange }: { locale: StaffLocale; onChange: (locale: StaffLocale) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label={locale === 'ru' ? 'Язык интерфейса' : 'Interface language'}
      className="inline-flex rounded-control border border-border-subtle bg-bg-surface p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
            className={`rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 font-mono text-[0.68rem] font-semibold tracking-wide transition-colors ${
              selected ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
