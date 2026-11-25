import { create } from 'zustand';
import type { ActivityCategory, ThemeMode } from '../types/domain';
import { AGPocketDB, createDefaultAppSettings, db, generateEntityId } from '../db/database';
import { ensureSeeded } from '../db/seedData';
import { sanitizePlainText } from '../services/security';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

export type QuickActionType = 'new_prompt' | 'new_project' | 'new_task';

export interface PendingPromptInjection {
  title?: string;
  body: string;
  tags?: string[];
  source: 'skill' | 'workflow' | 'project';
  mode: 'replace' | 'append';
}

export type DbStatus = 'idle' | 'initializing' | 'ready' | 'error';

export interface AppStoreState {
  theme: ThemeMode;
  reducedMotion: boolean;
  hapticsEnabled: boolean;
  isOnline: boolean;
  swNeedRefresh: boolean;
  swOfflineReady: boolean;
  navDrawerOpen: boolean;
  toasts: ToastItem[];
  quickActionTrigger: { action: QuickActionType; nonce: number } | null;
  pendingPromptInjection: PendingPromptInjection | null;
  dbStatus: DbStatus;
  dbError: string | null;

  initializeApp: (targetDb?: AGPocketDB) => Promise<void>;
  setTheme: (theme: ThemeMode, targetDb?: AGPocketDB) => Promise<void>;
  setReducedMotion: (enabled: boolean, targetDb?: AGPocketDB) => Promise<void>;
  setHapticsEnabled: (enabled: boolean, targetDb?: AGPocketDB) => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => void;
  setSwState: (partial: { swNeedRefresh?: boolean; swOfflineReady?: boolean }) => void;
  setNavDrawerOpen: (open: boolean) => void;
  triggerQuickAction: (action: QuickActionType) => void;
  clearQuickAction: () => void;
  queuePromptInjection: (payload: PendingPromptInjection) => void;
  consumePromptInjection: () => PendingPromptInjection | null;
  addToast: (message: string, variant?: ToastVariant) => string;
  dismissToast: (id: string) => void;
  resetEphemeralState: () => void;
}

const MAX_TOASTS = 5;

function syncDocumentPreferences(theme: ThemeMode, reducedMotion: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-reduced-motion', String(reducedMotion));
  root.classList.toggle('dark', theme === 'dark');
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'light' ? '#f8fafc' : '#000000');
  }
}

function getInitialOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  theme: 'dark',
  reducedMotion: false,
  hapticsEnabled: true,
  isOnline: getInitialOnlineStatus(),
  swNeedRefresh: false,
  swOfflineReady: false,
  navDrawerOpen: false,
  toasts: [],
  quickActionTrigger: null,
  pendingPromptInjection: null,
  dbStatus: 'idle',
  dbError: null,

  initializeApp: async (targetDb: AGPocketDB = db) => {
    set({ dbStatus: 'initializing', dbError: null });
    try {
      await ensureSeeded(targetDb);
      const settings = await targetDb.settings.get('default');
      const resolved = settings ?? createDefaultAppSettings();
      syncDocumentPreferences(resolved.theme, resolved.reducedMotion);
      set({
        theme: resolved.theme,
        reducedMotion: resolved.reducedMotion,
        hapticsEnabled: resolved.hapticsEnabled,
        dbStatus: 'ready',
        dbError: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to initialize local AG Pocket database.';
      set({
        dbStatus: 'error',
        dbError: message,
      });
    }
  },

  setTheme: async (theme: ThemeMode, targetDb: AGPocketDB = db) => {
    syncDocumentPreferences(theme, get().reducedMotion);
    set({ theme });
    try {
      const now = new Date().toISOString();
      const existing = await targetDb.settings.get('default');
      if (existing) {
        await targetDb.settings.update('default', { theme, updatedAt: now });
      } else {
        await targetDb.settings.put({ ...createDefaultAppSettings(now), theme });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save theme preference.';
      get().addToast(message, 'error');
    }
  },

  setReducedMotion: async (enabled: boolean, targetDb: AGPocketDB = db) => {
    syncDocumentPreferences(get().theme, enabled);
    set({ reducedMotion: enabled });
    try {
      const now = new Date().toISOString();
      const existing = await targetDb.settings.get('default');
      if (existing) {
        await targetDb.settings.update('default', { reducedMotion: enabled, updatedAt: now });
      } else {
        await targetDb.settings.put({
          ...createDefaultAppSettings(now),
          reducedMotion: enabled,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save reduced motion preference.';
      get().addToast(message, 'error');
    }
  },

  setHapticsEnabled: async (enabled: boolean, targetDb: AGPocketDB = db) => {
    set({ hapticsEnabled: enabled });
    try {
      const now = new Date().toISOString();
      const existing = await targetDb.settings.get('default');
      if (existing) {
        await targetDb.settings.update('default', { hapticsEnabled: enabled, updatedAt: now });
      } else {
        await targetDb.settings.put({
          ...createDefaultAppSettings(now),
          hapticsEnabled: enabled,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save haptics preference.';
      get().addToast(message, 'error');
    }
  },

  setOnlineStatus: (isOnline: boolean) => {
    set({ isOnline });
  },

  setSwState: (partial) => {
    set((state) => ({
      swNeedRefresh: partial.swNeedRefresh ?? state.swNeedRefresh,
      swOfflineReady: partial.swOfflineReady ?? state.swOfflineReady,
    }));
  },

  setNavDrawerOpen: (open: boolean) => {
    set({ navDrawerOpen: open });
  },

  triggerQuickAction: (action: QuickActionType) => {
    set((state) => ({
      quickActionTrigger: {
        action,
        nonce: (state.quickActionTrigger?.nonce ?? 0) + 1,
      },
    }));
  },

  clearQuickAction: () => {
    set({ quickActionTrigger: null });
  },

  queuePromptInjection: (payload: PendingPromptInjection) => {
    const cleanTags = Array.isArray(payload.tags)
      ? payload.tags.map((tag) => sanitizePlainText(tag, 100).trim()).filter(Boolean)
      : undefined;

    set({
      pendingPromptInjection: {
        ...payload,
        ...(payload.title !== undefined ? { title: sanitizePlainText(payload.title, 160) } : {}),
        body: sanitizePlainText(payload.body, 50000),
        ...(cleanTags !== undefined ? { tags: cleanTags } : {}),
      },
    });
  },

  consumePromptInjection: () => {
    const current = get().pendingPromptInjection;
    if (current) {
      set({ pendingPromptInjection: null });
    }
    return current;
  },

  addToast: (message: string, variant: ToastVariant = 'info') => {
    const id = generateEntityId();
    const cleanMessage = sanitizePlainText(message, 280).trim() || 'Notification';
    set((state) => {
      const next = [...state.toasts, { id, message: cleanMessage, variant }];
      return {
        toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next,
      };
    });
    return id;
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  resetEphemeralState: () => {
    set({
      theme: 'dark',
      reducedMotion: false,
      hapticsEnabled: true,
      isOnline: getInitialOnlineStatus(),
      swNeedRefresh: false,
      swOfflineReady: false,
      navDrawerOpen: false,
      toasts: [],
      quickActionTrigger: null,
      pendingPromptInjection: null,
      dbStatus: 'idle',
      dbError: null,
    });
  },
}));

export type { ActivityCategory };
