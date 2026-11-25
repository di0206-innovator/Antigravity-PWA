import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const hintId = hint ? `${textareaId}-hint` : undefined;
    const errorId = error ? `${textareaId}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1.5 min-w-0 w-full">
        {label ? (
          <label htmlFor={textareaId} className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-[96px] w-full min-w-0 rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors',
            error
              ? 'border-[var(--status-danger)]'
              : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
