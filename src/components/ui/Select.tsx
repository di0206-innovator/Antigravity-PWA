import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1.5 min-w-0 w-full">
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-[44px] w-full min-w-0 rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-base text-[var(--text-primary)] transition-colors',
            error
              ? 'border-[var(--status-danger)]'
              : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {hint ? (
          <p id={hintId} className="text-xs text-[var(--text-muted)]">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-[var(--status-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
