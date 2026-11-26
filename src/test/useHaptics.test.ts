import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHaptics } from '../hooks/useHaptics';
import { useAppStore } from '../stores/useAppStore';

describe('useHaptics', () => {
  const originalVibrate = navigator.vibrate;

  beforeEach(() => {
    useAppStore.getState().resetEphemeralState();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: originalVibrate,
    });
  });

  it('triggers navigator.vibrate when enabled and reducedMotion is false', () => {
    const vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrateMock,
    });

    const { result } = renderHook(() => useHaptics());
    expect(result.current.supported).toBe(true);

    let fired = false;
    act(() => {
      fired = result.current.triggerHaptic('success');
    });
    expect(fired).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith([10, 28, 12]);
  });

  it('suppresses vibration when hapticsEnabled is false or reducedMotion is true', () => {
    const vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrateMock,
    });

    act(() => {
      useAppStore.setState({ hapticsEnabled: false, reducedMotion: false });
    });
    const { result } = renderHook(() => useHaptics());
    expect(result.current.triggerHaptic('light')).toBe(false);

    act(() => {
      useAppStore.setState({ hapticsEnabled: true, reducedMotion: true });
    });
    expect(result.current.triggerHaptic('medium')).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();
  });
});
