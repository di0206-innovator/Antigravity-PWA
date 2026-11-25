import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from './cn';

export interface DisclosureBannerProps {
  variant?: 'info' | 'warning';
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function DisclosureBanner({
  variant = 'info',
  title,
  children,
  action,
  className,
}: DisclosureBannerProps) {
  const isWarning = variant === 'warning';
  return (
    <div
      role={isWarning ? 'status' : 'note'}
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm',
        isWarning
          ? 'border-[var(--status-warn)]/40 bg-[var(--status-warn-bg)] text-[var(--text-primary)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {isWarning ? (
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warn)]"
            aria-hidden="true"
          />
        ) : (
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 space-y-0.5">
          {title ? <p className="font-semibold text-[var(--text-primary)]">{title}</p> : null}
          <div className="leading-relaxed">{children}</div>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
