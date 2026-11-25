import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore, type ToastVariant } from '../../stores/useAppStore';
import { cn } from './cn';

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: 'border-[var(--accent-primary)]/40 bg-[var(--bg-elevated)] text-[var(--text-primary)]',
  success: 'border-[var(--status-ok)]/40 bg-[var(--bg-elevated)] text-[var(--text-primary)]',
  warning: 'border-[var(--status-warn)]/50 bg-[var(--bg-elevated)] text-[var(--text-primary)]',
  error: 'border-[var(--status-danger)]/50 bg-[var(--bg-elevated)] text-[var(--text-primary)]',
};

export function ToastRegion() {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    const timers: number[] = [];
    for (const toast of toasts) {
      if (toast.variant === 'error') continue;
      const timer = window.setTimeout(() => {
        dismissToast(toast.id);
      }, 4200);
      timers.push(timer);
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [toasts, dismissToast]);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-3 left-3 sm:left-auto sm:right-6 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-24 z-40 flex flex-col gap-2 sm:w-96"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg',
            VARIANT_CLASSES[toast.variant]
          )}
        >
          <span className="min-w-0 break-words leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="touch-target inline-flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
