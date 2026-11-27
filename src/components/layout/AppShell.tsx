import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  Activity,
  CheckSquare,
  ExternalLink,
  FolderKanban,
  GitBranch,
  Home,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Waypoints,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useHaptics } from '../../hooks/useHaptics';
import { OFFICIAL_ANTIGRAVITY_BASE_URL, openOfficialUrl } from '../../services/security';
import { useAppStore } from '../../stores/useAppStore';
import { AgMonogram } from '../ui/AgMonogram';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ToastRegion } from '../ui/ToastRegion';
import { cn } from '../ui/cn';

const PRIMARY_NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/prompts', label: 'Prompts', icon: Terminal, end: false },
  { to: '/skills', label: 'Skills', icon: Sparkles, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
] as const;

const SECONDARY_NAV_ITEMS = [
  {
    to: '/workflows',
    label: 'Workflow Library',
    description: 'Repeatable steps and copyable prompts',
    icon: GitBranch,
  },
  {
    to: '/tasks',
    label: 'Task Board',
    description: 'Manual local task tracker',
    icon: CheckSquare,
  },
  {
    to: '/activity',
    label: 'Activity Log',
    description: 'Local timeline of AG Pocket actions',
    icon: Activity,
  },
  {
    to: '/setup',
    label: 'Connection Setup Center',
    description: 'Desktop, mobile, CLI, and Remote Agents guide',
    icon: Waypoints,
  },
  {
    to: '/privacy',
    label: 'Privacy & Security',
    description: 'Local storage and official integration boundary',
    icon: ShieldCheck,
  },
] as const;

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isOnline = useOnlineStatus();
  const { triggerHaptic } = useHaptics();
  const navDrawerOpen = useAppStore((s) => s.navDrawerOpen);
  const setNavDrawerOpen = useAppStore((s) => s.setNavDrawerOpen);
  const swNeedRefresh = useAppStore((s) => s.swNeedRefresh);
  const setSwState = useAppStore((s) => s.setSwState);
  const addToast = useAppStore((s) => s.addToast);
  const dbError = useAppStore((s) => s.dbError);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(() => setNavDrawerOpen(false), [setNavDrawerOpen]);

  useFocusTrap(navDrawerOpen, drawerRef, closeDrawer);

  useEffect(() => {
    if (!navDrawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [navDrawerOpen]);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setSwState({ swNeedRefresh: true });
    },
    onOfflineReady() {
      setSwState({ swOfflineReady: true });
    },
  });

  const showUpdatePrompt = needRefresh || swNeedRefresh;

  const handleOpenOfficial = () => {
    triggerHaptic('light');
    const result = openOfficialUrl(OFFICIAL_ANTIGRAVITY_BASE_URL);
    if (!result.opened) {
      addToast(result.error ?? 'Unable to open Antigravity.', 'error');
    }
    closeDrawer();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-[var(--accent-primary-solid)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--accent-primary-fg)]"
      >
        Skip to main content
      </a>

      <header className="safe-top sticky top-0 z-30 w-full border-b border-[#252525]/12 bg-[#F4F1DF]/95 text-[#252525] backdrop-blur-md">
        <div className="flex w-full min-h-[var(--header-height,64px)] items-center justify-between gap-2 px-3 py-2 sm:px-6 lg:px-10">
          <Link
            to="/"
            className="touch-target inline-flex items-center gap-2 sm:gap-2.5 rounded-xl px-1.5 py-1 min-w-0"
          >
            <AgMonogram size={32} />
            <div className="min-w-0">
              <span
                className="block truncate text-[15px] min-[360px]:text-base font-extrabold tracking-tight text-[#252525]"
                style={{ fontFamily: 'var(--font-display, "Inter Tight", Inter, sans-serif)' }}
              >
                AG Pocket
              </span>
              <span className="hidden sm:block truncate text-xs font-medium text-[#526D30]">
                Antigravity Mobile Command Center
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 min-[360px]:gap-2 shrink-0">
            <Badge
              tone={isOnline ? 'success' : 'warning'}
              className="px-2.5 gap-1.5 rounded-full border border-[#252525]/10 bg-white/80 text-[#252525]"
            >
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5 shrink-0 text-[#526D30]" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 shrink-0 text-[#A67C00]" aria-hidden="true" />
              )}
              <span className="font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
            </Badge>

            <NavLink
              to="/settings"
              end
              aria-label="Open Settings"
              className="touch-target inline-flex items-center justify-center rounded-full border border-[#252525]/15 bg-white/85 px-2.5 text-[#252525] hover:border-[#526D30] hover:bg-white transition-colors"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </NavLink>

            <button
              type="button"
              onClick={() => setNavDrawerOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={navDrawerOpen}
              aria-controls="ag-nav-drawer"
              className="touch-target inline-flex items-center justify-center rounded-full border border-[#252525]/15 bg-white/85 px-2.5 text-[#252525] hover:border-[#526D30] hover:bg-white transition-colors cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {!isOnline ? (
        <div
          role="status"
          className="border-b border-[var(--status-warn)]/40 bg-[var(--status-warn-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-5xl items-start gap-2.5">
            <WifiOff
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warn)]"
              aria-hidden="true"
            />
            <p className="min-w-0 leading-snug">
              You are offline. Local AG Pocket modules work offline, while Remote Control (
              <span className="font-medium">https://antigravity.google.com</span>) requires an
              internet connection.
            </p>
          </div>
        </div>
      ) : null}

      {showUpdatePrompt ? (
        <div
          role="region"
          aria-label="Application update available"
          className="border-b border-[var(--accent-primary)]/40 bg-[var(--accent-blue-soft)] px-3 py-2.5 text-sm text-[var(--text-primary)] sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw
                className="h-4 w-4 shrink-0 text-[var(--accent-primary)]"
                aria-hidden="true"
              />
              <p className="min-w-0 font-medium">
                A new version of AG Pocket is ready. Reload to update.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  void updateServiceWorker(true);
                }}
              >
                Reload to Update
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNeedRefresh(false);
                  setSwState({ swNeedRefresh: false });
                }}
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {dbError ? (
        <div
          role="alert"
          className="border-b border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-3 py-2.5 text-sm text-[var(--status-danger)] sm:px-6"
        >
          <div className="mx-auto w-full max-w-5xl">{dbError}</div>
        </div>
      ) : null}

      <main
        id="main-content"
        className="flex-1 w-full min-w-0 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]"
      >
        {isHome ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 pt-4">{children}</div>
        )}
      </main>

      <nav
        aria-label="Primary navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 pointer-events-none"
      >
        <div className="mx-auto max-w-md px-3 pb-2 pointer-events-auto">
          <div className="grid grid-cols-5 gap-1 rounded-2xl border border-[#252525]/12 bg-[#F4F1DF]/95 px-1.5 py-1 shadow-lg backdrop-blur-md">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => triggerHaptic('light')}
                  className={({ isActive }) =>
                    cn(
                      'touch-target flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] sm:text-xs font-medium transition-colors min-w-0',
                      isActive
                        ? 'bg-[#526D30] text-white'
                        : 'text-[#252525]/80 hover:bg-[#252525]/8 hover:text-[#252525]'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate max-w-full leading-none">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {navDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-[var(--backdrop)]"
            onClick={closeDrawer}
          />
          <div
            id="ag-nav-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            className="relative z-10 flex h-full w-full max-w-xs sm:max-w-sm flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl overflow-y-auto safe-top safe-bottom"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <AgMonogram size={28} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    AG Pocket
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    Command Center Navigation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close navigation menu"
                className="touch-target inline-flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-5 p-4">
              <div className="space-y-1.5">
                <p className="px-2 text-xs font-medium text-[var(--text-muted)]">
                  Secondary modules
                </p>
                <ul className="space-y-1">
                  {SECONDARY_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={closeDrawer}
                          className="touch-target flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors"
                        >
                          <Icon
                            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-[var(--text-primary)]">
                              {item.label}
                            </span>
                            <span className="block text-xs text-[var(--text-muted)]">
                              {item.description}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
                <p className="px-2 text-xs font-medium text-[var(--text-muted)]">
                  Primary workspace
                </p>
                <ul className="space-y-1">
                  {PRIMARY_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={`drawer-${item.to}`}>
                        <NavLink
                          to={item.to}
                          onClick={closeDrawer}
                          className="touch-target flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="border-t border-[var(--border-subtle)] p-4 space-y-2.5">
              <Button className="w-full" onClick={handleOpenOfficial}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>Open Antigravity</span>
              </Button>
              <Link
                to="/setup"
                onClick={closeDrawer}
                className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Wrench className="h-4 w-4" aria-hidden="true" />
                <span>Connection Setup Guide</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <ToastRegion />
    </div>
  );
}
