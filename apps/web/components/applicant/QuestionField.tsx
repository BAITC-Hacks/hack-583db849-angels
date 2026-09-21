'use client';

import type { DraftAnswerPatch, FormQuestion } from '@invision/stand-client';
import { useId } from 'react';

type Value = DraftAnswerPatch[string];

const control =
  'w-full rounded-control border border-border-strong bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-ink focus:ring-2 focus:ring-brand-ink/25';

/**
 * Renders one question from the bound form version.
 *
 * Nothing about the questions is hardcoded: the type, the label, the help text,
 * the options and the constraints all come from the published version, so a new
 * version changes the form without touching this file. An unfamiliar type is
 * shown as an explicit, readable gap rather than crashing or silently vanishing
 * — enum evolution is a coordinated change, and a client from before that change
 * has to degrade in a way the applicant can see and report.
 */
export function QuestionField({
  question,
  value,
  invalid,
  onChange,
  onCommit,
}: {
  question: FormQuestion;
  value: Value | undefined;
  invalid?: boolean;
  onChange: (value: Value) => void;
  onCommit: () => void;
}) {
  const id = useId();
  const describedBy = question.helpText ? `${id}-help` : undefined;
  const ring = invalid ? 'border-status-low focus:border-status-low focus:ring-status-low/30' : '';

  const text = typeof value === 'string' ? value : '';
  const number = typeof value === 'number' ? String(value) : '';
  const selected = Array.isArray(value) ? value : [];

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle px-5 py-5 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={id} className="text-sm font-semibold text-text-primary">
          {question.label}
        </label>
        <span className="font-mono text-[0.58rem] tracking-wide text-text-muted">{question.id}</span>
      </div>

      {question.helpText ? (
        <p id={describedBy} className="text-sm text-text-secondary">
          {question.helpText}
        </p>
      ) : null}

      {question.type === 'TEXT' ? (
        <input
          id={id}
          type="text"
          value={text}
          maxLength={question.constraints?.maxLength}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} ${ring}`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
        />
      ) : null}

      {question.type === 'TEXTAREA' ? (
        <textarea
          id={id}
          rows={4}
          value={text}
          maxLength={question.constraints?.maxLength}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} ${ring} resize-y`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
        />
      ) : null}

      {question.type === 'NUMBER' ? (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={number}
          min={question.constraints?.minimum}
          max={question.constraints?.maximum}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} ${ring}`}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw.trim() === '') return onChange(null);
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? parsed : null);
          }}
          onBlur={onCommit}
        />
      ) : null}

      {question.type === 'DATE' ? (
        <input
          id={id}
          type="date"
          value={text}
          min={question.constraints?.minDate}
          max={question.constraints?.maxDate}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} ${ring}`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
        />
      ) : null}

      {question.type === 'SINGLE_SELECT' ? (
        <select
          id={id}
          value={text}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} ${ring}`}
          onChange={(event) => {
            onChange(event.target.value === '' ? null : event.target.value);
            onCommit();
          }}
        >
          <option value="">Not selected</option>
          {(question.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {question.type === 'MULTI_SELECT' ? (
        <fieldset className="flex flex-col gap-2" aria-describedby={describedBy}>
          <legend className="sr-only">{question.label}</legend>
          {(question.options ?? []).map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2.5 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={checked}
                  className="h-4 w-4 rounded border-border-strong accent-brand-green"
                  onChange={() => {
                    const next = checked
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value];
                    onChange(next.length === 0 ? null : next);
                    onCommit();
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {!['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'MULTI_SELECT'].includes(question.type) ? (
        <p className="rounded-control border border-dashed border-border-strong px-3.5 py-2.5 text-sm text-text-secondary">
          This question is newer than your version of the page. Refresh to answer it.
        </p>
      ) : null}
    </div>
  );
}
