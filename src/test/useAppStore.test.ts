import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGPocketDB } from '../db/database';
import { useAppStore } from '../stores/useAppStore';

describe('useAppStore', () => {
  const createdDbs: AGPocketDB[] = [];

  function createIsolatedDb(suffix: string): AGPocketDB {
    const instance = new AGPocketDB(`ag-pocket-store-${suffix}-${Math.random().toString(36).slice(2)}`);
    createdDbs.push(instance);
    return instance;
  }

  beforeEach(() => {
    useAppStore.getState().resetEphemeralState();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-reduced-motion');
    document.documentElement.classList.remove('dark');
  });

  afterEach(async () => {
    document.querySelector('meta[name="theme-color"]')?.remove();
    while (createdDbs.length > 0) {
      const instance = createdDbs.pop();
      if (instance) {
        await instance.delete();
      }
    }
  });

  it('initializes DB, syncs document theme/motion attributes and theme-color meta, and persists theme updates', async () => {
    const testDb = createIsolatedDb('init');
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#000000';
    document.head.appendChild(meta);

    await useAppStore.getState().initializeApp(testDb);
    expect(useAppStore.getState().dbStatus).toBe('ready');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('false');
    expect(meta.getAttribute('content')).toBe('#000000');

    await useAppStore.getState().setTheme('light', testDb);
    await useAppStore.getState().setReducedMotion(true, testDb);
    await useAppStore.getState().setHapticsEnabled(false, testDb);

    expect(useAppStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(meta.getAttribute('content')).toBe('#f8fafc');

    const saved = await testDb.settings.get('default');
    expect(saved?.theme).toBe('light');
    expect(saved?.reducedMotion).toBe(true);
    expect(saved?.hapticsEnabled).toBe(false);
  });

  it('handles prompt injection handoff, quick actions, and toast queue', () => {
    const store = useAppStore.getState();

    store.queuePromptInjection({
      title: 'Hallmark UI\u0000',
      body: 'Use Hallmark design principles.\u0007',
      tags: ['  design\u0000  ', '\u0001\u0002', 'mobile\u0007'],
      source: 'skill',
      mode: 'append',
    });

    const consumed = useAppStore.getState().consumePromptInjection();
    expect(consumed).toEqual({
      title: 'Hallmark UI',
      body: 'Use Hallmark design principles.',
      tags: ['design', 'mobile'],
      source: 'skill',
      mode: 'append',
    });
    expect(useAppStore.getState().consumePromptInjection()).toBeNull();

    store.triggerQuickAction('new_prompt');
    expect(useAppStore.getState().quickActionTrigger).toEqual({
      action: 'new_prompt',
      nonce: 1,
    });

    const toastId = store.addToast('Prompt copied locally', 'success');
    expect(useAppStore.getState().toasts).toHaveLength(1);
    store.dismissToast(toastId);
    expect(useAppStore.getState().toasts).toHaveLength(0);
  });

  it('captures initialization failures into dbError state cleanly', async () => {
    const testDb = createIsolatedDb('err');
    const txSpy = vi.spyOn(testDb, 'transaction').mockRejectedValueOnce(new Error('IDB blocked'));

    await useAppStore.getState().initializeApp(testDb);
    expect(useAppStore.getState().dbStatus).toBe('error');
    expect(useAppStore.getState().dbError).toBeTruthy();

    txSpy.mockRestore();
  });
});
