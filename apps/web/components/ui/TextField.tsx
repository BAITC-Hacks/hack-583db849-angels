import { useId } from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: string[];
  hint?: string;
}

export function TextField({ label, errors, hint, id, className, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hasError = Boolean(errors?.length);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`w-full rounded-control border bg-bg-surface px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:ring-2 focus:ring-offset-0 ${
          hasError
            ? 'border-status-low focus:border-status-low focus:ring-status-low/30'
            : 'border-border-strong focus:border-brand-ink focus:ring-brand-ink/25'
        } ${className ?? ''}`}
        {...inputProps}
      />
      {hasError ? (
        <p id={`${fieldId}-error`} className="text-sm font-medium text-status-low">
          {errors?.[0]}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
