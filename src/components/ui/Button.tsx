import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  'touch-target inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent-primary-solid)] text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]',
        secondary:
          'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
        outline:
          'bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
        danger:
          'bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger)]/40 hover:border-[var(--status-danger)]',
      },
      size: {
        sm: 'min-h-[44px] px-3.5 py-2 text-sm',
        md: 'min-h-[44px] px-4 py-2.5 text-sm',
        lg: 'min-h-[48px] px-5 py-3 text-base font-semibold',
        icon: 'min-h-[44px] min-w-[44px] p-2.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
