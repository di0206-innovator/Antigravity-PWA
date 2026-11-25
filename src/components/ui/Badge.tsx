import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap max-w-full',
  {
    variants: {
      tone: {
        neutral:
          'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
        info: 'border-[var(--accent-primary)]/40 bg-[var(--accent-blue-soft)] text-[var(--text-primary)]',
        violet:
          'border-[var(--accent-violet)]/40 bg-[var(--accent-violet-soft)] text-[var(--text-primary)]',
        success:
          'border-[var(--status-ok)]/40 bg-[var(--status-ok-bg)] text-[var(--status-ok)]',
        warning:
          'border-[var(--status-warn)]/40 bg-[var(--status-warn-bg)] text-[var(--status-warn)]',
        danger:
          'border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] text-[var(--status-danger)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
