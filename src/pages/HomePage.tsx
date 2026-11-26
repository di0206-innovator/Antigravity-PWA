import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckSquare,
  ExternalLink,
  FolderPlus,
  GitBranch,
  Pin,
  PlusCircle,
  Settings,
  Sparkles,
  Waypoints,
  WifiOff,
} from 'lucide-react';
import { logActivity } from '../db/activityService';
import { db } from '../db/database';
import { useHaptics } from '../hooks/useHaptics';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  OFFICIAL_ANTIGRAVITY_BASE_URL,
  OFFICIAL_DOCS_URLS,
  openOfficialUrl,
} from '../services/security';
import { useAppStore } from '../stores/useAppStore';
import {
  computeConnectionReadiness,
  TASK_STATUSES,
  type AppSettings,
  type ConnectionReadiness,
  type Project,
  type TaskItem,
} from '../types/domain';
import { AgMonogram } from '../components/ui/AgMonogram';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import ParallaxHero from '../components/ParallaxHero';


import { EmptyState } from '../components/ui/EmptyState';

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getReadinessTone(readiness: ConnectionReadiness) {
  switch (readiness) {
    case 'Ready to open':
      return 'success' as const;
    case 'Remote connection not verified':
      return 'info' as const;
    case 'Setup instructions available':
      return 'violet' as const;
    case 'Not configured':
    default:
      return 'neutral' as const;
  }
}

function getReadinessHint(readiness: ConnectionReadiness): string {
  switch (readiness) {
    case 'Ready to open':
      return 'Local setup checklist completed. Remote availability still depends on your active host and Google sign-in.';
    case 'Remote connection not verified':
      return 'Local launcher or project links exist, but desktop and mobile steps are not both confirmed in Setup Center.';
    case 'Setup instructions available':
      return 'Reference steps reviewed locally. Finish desktop and mobile confirmation in Setup Center when ready.';
    case 'Not configured':
    default:
      return 'No host setup recorded locally yet. Open Setup Center to walk through Desktop and Mobile steps.';
  }
}

function getPriorityTone(priority: TaskItem['priority']) {
  switch (priority) {
    case 'Critical':
      return 'danger' as const;
    case 'High':
      return 'warning' as const;
    case 'Medium':
      return 'info' as const;
    case 'Low':
    default:
      return 'neutral' as const;
  }
}



export function HomePage() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { triggerHaptic } = useHaptics();
  const dbStatus = useAppStore((s) => s.dbStatus);
  const triggerQuickAction = useAppStore((s) => s.triggerQuickAction);
  const addToast = useAppStore((s) => s.addToast);

  const [now] = useState(() => new Date());
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      try {
        const [loadedSettings, loadedProjects, loadedTasks] = await Promise.all([
          db.settings.get('default'),
          db.projects.orderBy('updatedAt').reverse().toArray(),
          db.tasks.orderBy('updatedAt').reverse().toArray(),
        ]);

        if (cancelled) return;
        setSettings(loadedSettings);
        setProjects(loadedProjects);
        setTasks(loadedTasks);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load local workspace overview.'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [dbStatus]);

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(now);

  const readiness = computeConnectionReadiness(settings, projects);
  const pinnedProjects = projects.filter((p) => p.pinned);
  const activeTasks = tasks.filter((t) => t.status !== 'Completed');

  const statusCounts = TASK_STATUSES.map((status) => ({
    status,
    count: tasks.filter((t) => t.status === status).length,
  }));

  const handleOpenAntigravity = (url: string = OFFICIAL_ANTIGRAVITY_BASE_URL, projectId?: string) => {
    triggerHaptic('medium');
    const result = openOfficialUrl(url);
    if (!result.opened) {
      addToast(result.error ?? 'Unable to open official Antigravity URL.', 'error');
      return;
    }
    void logActivity({
      category: projectId ? 'project' : 'setup',
      projectId,
      description: projectId
        ? 'Opened saved official Antigravity project URL'
        : 'Opened official Antigravity Remote Control',
    }).catch(() => { });
  };

  return (
    <div className="space-y-5">
      <ParallaxHero />
      {/* Header & Locally Knowable Status */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AgMonogram size={44} />
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-secondary)]">
                {getGreeting(now)} — {formattedDate}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                AG Pocket Command Center
              </h1>
            </div>
          </div>

          <Link
            to="/settings"
            aria-label="Open Settings"
            className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors shrink-0"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-[var(--border-subtle)] pt-3.5">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Setup readiness (local only):
              </span>
              <Badge tone={getReadinessTone(readiness)}>{readiness}</Badge>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {getReadinessHint(readiness)}
            </p>
          </div>
          <Link
            to="/setup"
            className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0 self-start sm:self-center"
          >
            <Waypoints className="h-3.5 w-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>Setup Center</span>
          </Link>
        </div>
      </section>

      {loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] p-3.5 text-sm text-[var(--status-danger)]"
        >
          {loadError}
        </div>
      ) : null}

      {/* Official Remote Control Launcher + Remote Access Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-7 border-[var(--accent-primary)]/40">
          <CardHeader>
            <CardTitle>Antigravity Remote Control</CardTitle>
            <CardDescription>
              Launch Google&apos;s official Remote Control interface directly in a new browser tab.
              AG Pocket never proxies credentials or submits prompts automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isOnline ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--status-warn)]/40 bg-[var(--status-warn-bg)] p-3 text-sm text-[var(--text-primary)]">
                <WifiOff
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warn)]"
                  aria-hidden="true"
                />
                <span>
                  Device is offline. Opening{' '}
                  <span className="font-medium">https://antigravity.google.com</span> requires an
                  active internet connection.
                </span>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                size="lg"
                className="flex-1 tracking-normal"
                onClick={() => handleOpenAntigravity(OFFICIAL_ANTIGRAVITY_BASE_URL)}
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>OPEN ANTIGRAVITY</span>
              </Button>
              <Link
                to="/setup"
                className="touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Waypoints className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>Connection Setup Guide</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Remote Access Overview</CardTitle>
            <CardDescription>
              Choose the official Antigravity mode that fits your session.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--border-subtle)] text-sm">
            <div className="pb-3 space-y-1">
              <p className="font-medium text-[var(--text-primary)]">Remote Control (Local Host)</p>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Drives desktop editor or <code className="text-[var(--text-primary)]">agy</code> CLI
                sessions running on your own workstation via{' '}
                <span className="font-medium">antigravity.google.com</span>.
              </p>
            </div>
            <div className="pt-3 space-y-1">
              <p className="font-medium text-[var(--text-primary)]">
                Remote Agents (Cloud Sandbox)
              </p>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Runs in an isolated Google-managed cloud environment for AI Pro and AI Ultra
                personal Google accounts without keeping a local host awake.
              </p>
            </div>
          </CardContent>
          <CardFooter className="text-xs">
            <a
              href={OFFICIAL_DOCS_URLS.remoteControl}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
            >
              <span>Remote Control Docs</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              href={OFFICIAL_DOCS_URLS.remoteAgents}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1 text-[var(--accent-violet)] hover:underline"
            >
              <span>Remote Agents Docs</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </CardFooter>
        </Card>
      </div>

      {/* 6 Quick Action Cards */}
      <section aria-labelledby="quick-actions-heading" className="space-y-2.5">
        <h2
          id="quick-actions-heading"
          className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text-primary)]"
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              triggerQuickAction('new_prompt');
              navigate('/prompts');
            }}
            className="touch-target flex flex-col items-start justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer min-w-0"
          >
            <PlusCircle className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                New Prompt
              </span>
              <span className="block text-xs text-[var(--text-muted)]">
                Draft in Prompt Studio
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAntigravity(OFFICIAL_ANTIGRAVITY_BASE_URL)}
            className="touch-target flex flex-col items-start justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer min-w-0"
          >
            <ExternalLink className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                Open Antigravity
              </span>
              <span className="block text-xs text-[var(--text-muted)]">
                Launch official web UI
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              triggerQuickAction('new_project');
              navigate('/projects');
            }}
            className="touch-target flex flex-col items-start justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer min-w-0"
          >
            <FolderPlus className="h-5 w-5 text-[var(--accent-violet)]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                New Project
              </span>
              <span className="block text-xs text-[var(--text-muted)]">
                Save workspace record
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              navigate('/skills');
            }}
            className="touch-target flex flex-col items-start justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer min-w-0"
          >
            <Sparkles className="h-5 w-5 text-[var(--accent-violet)]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                Browse Skills
              </span>
              <span className="block text-xs text-[var(--text-muted)]">
                Local prompt snippets
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              triggerQuickAction('new_task');
              navigate('/tasks');
            }}
            className="touch-target flex flex-col items-start justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer min-w-0"
          >
            <CheckSquare className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                New Task Note
              </span>
              <span className="block text-xs text-[var(--text-muted)]">
                Add to personal board
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              navigate('/workflows');
            }}
            className="touch-target flex flex-col items-start justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer min-w-0"
          >
            <GitBranch className="h-5 w-5 text-[var(--accent-violet)]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                View Workflow Library
              </span>
              <span className="block text-xs text-[var(--text-muted)]">
                Step-by-step guides
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Pinned Projects & Personal Task Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Pinned Projects</CardTitle>
              <CardDescription>Quick access to pinned workspaces and session links.</CardDescription>
            </div>
            <Link
              to="/projects"
              className="touch-target inline-flex items-center px-2.5 text-xs font-medium text-[var(--accent-primary)] hover:underline shrink-0"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading pinned projects...</p>
            ) : pinnedProjects.length === 0 ? (
              <EmptyState
                icon={<Pin className="h-5 w-5" aria-hidden="true" />}
                title="No pinned projects yet"
                description="Pin your active projects in Projects to launch their official Antigravity session URLs directly from Home."
                action={
                  <Link
                    to="/projects"
                    className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border-strong)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Manage Projects
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {pinnedProjects.map((project) => (
                  <li
                    key={project.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)] truncate"
                        >
                          {project.title}
                        </Link>
                        <Badge tone="neutral">{project.category}</Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {[project.machineName, project.workspaceLabel].filter(Boolean).join(' — ') ||
                          'No machine or workspace label saved'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to={`/projects/${project.id}`}
                        className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Details
                      </Link>
                      {project.officialUrl ? (
                        <Button
                          size="sm"
                          onClick={() => handleOpenAntigravity(project.officialUrl, project.id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Open</span>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Personal Task Overview</CardTitle>
              <CardDescription>Local task counts and active items.</CardDescription>
            </div>
            <Link
              to="/tasks"
              className="touch-target inline-flex items-center px-2.5 text-xs font-medium text-[var(--accent-primary)] hover:underline shrink-0"
            >
              Task Board
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <DisclosureBanner>
              Personal local tracker — manually updated, not synced with live Antigravity agent
              state.
            </DisclosureBanner>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {statusCounts.map((item) => (
                <div
                  key={item.status}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 px-2.5 py-2 min-w-0"
                >
                  <p className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                    {item.count}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{item.status}</p>
                </div>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading personal tasks...</p>
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="h-5 w-5" aria-hidden="true" />}
                title="No personal tasks yet"
                description="Track follow-ups, review items, and prompts to run next in your local Task Board."
                action={
                  <Link
                    to="/tasks"
                    className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border-strong)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Open Task Board
                  </Link>
                }
              />
            ) : activeTasks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                All {tasks.length} personal tasks are marked Completed.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {activeTasks.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link
                        to="/tasks"
                        className="block truncate text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                      >
                        {task.title}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)]">{task.status}</p>
                    </div>
                    <Badge tone={getPriorityTone(task.priority)}>{task.priority}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
