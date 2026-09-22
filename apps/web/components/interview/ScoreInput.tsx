'use client';

import type { Score } from '../evidence/ScoreMeter';

/** 0–4, or "not enough to judge" — never a silent zero for a missing view. */
export function ScoreInput({
  value,
  onChange,
  disabled,
  label,
  notEnough,
}: {
  value: Score | undefined;
  onChange: (score: Score) => void;
  disabled: boolean;
  label: string;
  notEnough: string;
}) {
  const options: Score[] = [0, 1, 2, 3, 4, null];

  return (
    // The same two rows everywhere: the scale, then "not enough" beneath it.
    <div role="radiogroup" aria-label={label} className="grid w-[11.5rem] shrink-0 grid-cols-5 gap-1">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`h-8 rounded-control border px-2.5 font-mono text-[0.75rem] font-semibold transition-colors disabled:cursor-not-allowed ${
              selected
                ? option === null
                  ? 'border-border-strong bg-bg-elevated text-text-primary'
                  : 'border-transparent bg-brand-green text-on-brand'
                : 'border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary disabled:hover:border-border-subtle'
            } ${disabled && !selected ? 'opacity-40' : ''} ${option === null ? 'col-span-5 text-[0.68rem]' : 'px-0'}`}
          >
            {option === null ? notEnough : option}
          </button>
        );
      })}
    </div>
  );
}
