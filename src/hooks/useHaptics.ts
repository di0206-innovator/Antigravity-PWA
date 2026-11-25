import { useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';

export type HapticKind = 'light' | 'medium' | 'success' | 'warning';

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 18,
  success: [10, 28, 12],
  warning: [18, 36, 18],
};

function isVibrateSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function useHaptics() {
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const supported = isVibrateSupported();

  const triggerHaptic = useCallback(
    (kind: HapticKind = 'light'): boolean => {
      if (!hapticsEnabled || reducedMotion || !isVibrateSupported()) {
        return false;
      }
      try {
        return navigator.vibrate(HAPTIC_PATTERNS[kind]);
      } catch {
        return false;
      }
    },
    [hapticsEnabled, reducedMotion]
  );

  return {
    supported,
    triggerHaptic,
  };
}
