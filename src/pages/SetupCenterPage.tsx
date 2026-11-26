import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Cloud,
  Copy,
  ExternalLink,
  HelpCircle,
  Laptop,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { logActivity } from '../db/activityService';
import { createDefaultAppSettings, db } from '../db/database';
import { useHaptics } from '../hooks/useHaptics';
import {
  OFFICIAL_ANTIGRAVITY_BASE_URL,
  OFFICIAL_DOCS_URLS,
  openOfficialUrl,
} from '../services/security';
import { useAppStore } from '../stores/useAppStore';
import {
  computeConnectionReadiness,
  type AppSettings,
  type Project,
  type SetupWizardState,
} from '../types/domain';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';

type WizardStepKey = keyof Omit<SetupWizardState, 'lastUpdatedAt'>;

interface CliReferenceItem {
  id: string;
  command: string;
  title: string;
  summary: string;
  notes: string;
}

const CLI_REFERENCE_COMMANDS: CliReferenceItem[] = [
  {
    id: 'slash-rc',
    command: '/remote-control',
    title: 'Enable Remote Control mid-session',
    summary:
      'Turns on Remote Control inside an active interactive Antigravity CLI session without restarting.',
    notes:
      'Use `/remote-control on` or `/remote-control off` to toggle. Prints Hostname and a direct handoff link (https://antigravity.google.com/r/<instance-id>?p=c%2F<conversation-id>).',
  },
  {
    id: 'agy-rc',
    command: 'agy --remote-control',
    title: 'Launch interactive CLI with Remote Control',
    summary: 'Starts a new interactive Antigravity CLI session with Remote Control active.',
    notes:
      'Lifecycle is tied to your running terminal process and stops on `/exit`, `Ctrl+C`, `Ctrl+D`, or closing the terminal.',
  },
  {
    id: 'rc-start',
    command: 'agy remote-control start',
    title: 'Start persistent background daemon',
    summary:
      'Registers and starts an always-on background service (optional `--name "<name>"` flag).',
    notes:
      'Auto-generates a friendly hostname if `--name` is omitted and cleans up older script-installed daemons.',
  },
  {
    id: 'rc-status',
    command: 'agy remote-control status',
    title: 'Check background daemon status',
    summary: 'Displays whether the CLI Remote Control daemon is running and its persistent hostname.',
    notes: 'Useful for verifying authentication and service registration on your workstation.',
  },
  {
    id: 'rc-stop',
    command: 'agy remote-control stop',
    title: 'Stop and unregister background daemon',
    summary: 'Stops the headless CLI Remote Control daemon and unregisters the OS background service.',
    notes: 'Use this when retiring a machine or switching solely to interactive sessions.',
  },
];

const DAEMON_OS_LIFECYCLE = [
  {
    os: 'Linux',
    service: 'systemd user service',
    lifecycle: 'Starts at boot (no login needed), survives logout, auto-restarts on crash.',
    logs: 'journalctl --user -u antigravity-cli-daemon -n 50',
  },
  {
    os: 'macOS',
    service: 'LaunchAgent',
    lifecycle: 'Starts at user login, stops on logout (resumes next login), auto-restarts on crash.',
    logs: '~/Library/Logs/antigravity-cli-daemon.log',
  },
  {
    os: 'Windows',
    service: 'Scheduled Task',
    lifecycle:
      'Administrator prompt registers start-at-boot (survives logout); normal prompt starts at login only; up to 3 crash restarts.',
    logs: '%USERPROFILE%\\.gemini\\antigravity-cli\\log\\cli-*.log',
  },
] as const;

const WIZARD_STEPS: Array<{
  key: WizardStepKey;
  title: string;
  detail: string;
}> = [
  {
    key: 'desktopRemoteControlEnabled',
    title: '1. Enable Remote Control in Antigravity Desktop',
    detail:
      'Open Settings (Cmd+, on macOS, Ctrl+, on Linux/Windows, or Settings at the bottom of the left sidebar) -> Application -> toggle Enable Remote Control On, and optionally set a Device Name.',
  },
  {
    key: 'mobileLauncherVerified',
    title: '2. Sign in on Mobile at antigravity.google.com',
    detail:
      'Open https://antigravity.google.com in your mobile browser, sign in with the same Google Account as your desktop, and confirm your machine appears in the instance switcher.',
  },
  {
    key: 'cliReferenceReviewed',
    title: '3. Review CLI Interactive & Daemon Commands',
    detail:
      'Understand `/remote-control`, `agy --remote-control`, and `agy remote-control start|status|stop` depending on whether you want terminal-scoped or always-on daemon access.',
  },
  {
    key: 'remoteAgentsReviewed',
    title: '4. Review Remote Agents Cloud Sandbox',
    detail:
      'Check whether Google AI Pro / Ultra Remote Agents (`agy --remote-agent`) fits cloud tasks when your workstation is offline.',
  },
];

export function SetupCenterPage() {
  const { triggerHaptic } = useHaptics();
  const dbStatus = useAppStore((s) => s.dbStatus);
  const addToast = useAppStore((s) => s.addToast);

  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<WizardStepKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [loadedSettings, loadedProjects] = await Promise.all([
          db.settings.get('default'),
          db.projects.toArray(),
        ]);
        if (cancelled) return;
        setSettings(loadedSettings);
        setProjects(loadedProjects);
      } catch (err) {
        if (cancelled) return;
        addToast(
          err instanceof Error ? err.message : 'Unable to load setup checklist.',
          'error'
        );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dbStatus, addToast]);

  const readiness = computeConnectionReadiness(settings, projects);

  const handleToggleStep = async (key: WizardStepKey) => {
    setSavingKey(key);
    try {
      const now = new Date().toISOString();
      const existing = (await db.settings.get('default')) ?? createDefaultAppSettings(now);
      const nextValue = !existing.setupWizard[key];
      const updated: AppSettings = {
        ...existing,
        setupWizard: {
          ...existing.setupWizard,
          [key]: nextValue,
          lastUpdatedAt: now,
        },
        updatedAt: now,
      };
      await db.settings.put(updated);
      setSettings(updated);
      triggerHaptic('success');
      void logActivity({
        category: 'setup',
        description: `${nextValue ? 'Completed' : 'Unchecked'} setup step: ${key}`,
      }).catch(() => {});
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save setup progress.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCopyCommand = async (item: CliReferenceItem) => {
    triggerHaptic('light');
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      addToast(`Clipboard unavailable. Copy manually: ${item.command}`, 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(item.command);
      setCopiedId(item.id);
      addToast(`Copied "${item.command}" to clipboard.`, 'success');
      window.setTimeout(() => {
        setCopiedId((current) => (current === item.id ? null : current));
      }, 2000);
    } catch {
      addToast(`Unable to access clipboard. Copy manually: ${item.command}`, 'warning');
    }
  };

  const handleOpenOfficial = () => {
    triggerHaptic('light');
    const result = openOfficialUrl(OFFICIAL_ANTIGRAVITY_BASE_URL);
    if (!result.opened) {
      addToast(result.error ?? 'Unable to open official Antigravity URL.', 'error');
      return;
    }
    void logActivity({
      category: 'setup',
      description: 'Opened Antigravity web launcher from Setup Center',
    }).catch(() => {});
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Connection Setup Center</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Configure Desktop Remote Control, Mobile access, CLI commands, and Remote Agents.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--text-muted)]">Local readiness:</span>
          <Badge tone={readiness === 'Ready to open' ? 'success' : 'info'}>{readiness}</Badge>
        </div>
      </header>

      {/* Interactive Setup Wizard */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <CardTitle>Desktop &amp; Mobile Setup Wizard</CardTitle>
          </div>
          <CardDescription>
            Track your setup steps locally. Marking steps complete updates your Home readiness badge
            without claiming live remote verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {WIZARD_STEPS.map((step) => {
              const checked = Boolean(settings?.setupWizard[step.key]);
              return (
                <li key={step.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {step.title}
                      </p>
                      <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
                        {step.detail}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={checked ? 'primary' : 'outline'}
                      aria-pressed={checked}
                      disabled={savingKey === step.key}
                      onClick={() => void handleToggleStep(step.key)}
                      className="shrink-0"
                    >
                      {checked ? (
                        <>
                          <Check className="h-4 w-4" aria-hidden="true" />
                          <span>Done</span>
                        </>
                      ) : (
                        <span>Mark done</span>
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
            <Button onClick={handleOpenOfficial}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span>Open Antigravity</span>
            </Button>
            <a
              href={OFFICIAL_DOCS_URLS.remoteControl}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <Smartphone className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>Official Remote Control Docs</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Non-Executing CLI Reference */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <CardTitle>Non-Executing CLI Reference</CardTitle>
          </div>
          <CardDescription>
            Official Antigravity CLI commands for interactive sessions and headless background
            daemons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DisclosureBanner variant="warning" title="Reference only — never executed by AG Pocket">
            AG Pocket never wraps or executes the Antigravity CLI. Copy commands below and run them
            directly in your workstation terminal.
          </DisclosureBanner>

          <div className="divide-y divide-[var(--border-subtle)]">
            {CLI_REFERENCE_COMMANDS.map((item) => (
              <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{item.summary}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleCopyCommand(item)}
                    aria-label={`Copy command ${item.command}`}
                    className="shrink-0 self-start sm:self-center"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="h-4 w-4 text-[var(--status-ok)]" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-code)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text-code)]">
                  <code>{item.command}</code>
                </pre>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{item.notes}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Interactive vs Background Daemon by OS
            </h3>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Interactive sessions (<code className="text-[var(--text-primary)]">/remote-control</code>{' '}
              and <code className="text-[var(--text-primary)]">agy --remote-control</code>) stop when
              the terminal closes. Background daemons (
              <code className="text-[var(--text-primary)]">agy remote-control start</code>) persist
              via your OS service manager and store their hostname under{' '}
              <code className="text-[var(--text-primary)]">cliRemoteControlHostname</code> (separate
              from desktop <code className="text-[var(--text-primary)]">remoteControlHostname</code>)
              in <code className="text-[var(--text-primary)]">~/.gemini/config/config.json</code>.
            </p>

            <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/40">
              {DAEMON_OS_LIFECYCLE.map((row) => (
                <div key={row.os} className="p-3 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{row.os}</span>
                    <Badge tone="neutral">{row.service}</Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    {row.lifecycle}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] break-all">
                    Logs: <code>{row.logs}</code>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remote Agents Explanation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-[var(--accent-violet)]" aria-hidden="true" />
            <CardTitle>Remote Agents (Cloud Sandbox)</CardTitle>
          </div>
          <CardDescription>
            Run sessions in an isolated Google-managed cloud environment without a local host
            machine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/40 p-3.5 space-y-1.5">
              <p className="font-semibold text-[var(--text-primary)]">Eligibility &amp; CLI</p>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Available to <strong>Google AI Pro</strong> and <strong>Google AI Ultra</strong>{' '}
                subscribers using a personal Google Account (not free tier, AI Plus, or Google
                Workspace business accounts). Requires Antigravity CLI{' '}
                <code className="text-[var(--text-primary)]">1.4.12+</code> via{' '}
                <code className="text-[var(--text-primary)]">agy --remote-agent</code>.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/40 p-3.5 space-y-1.5">
              <p className="font-semibold text-[var(--text-primary)]">Remote Resources</p>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Connects GitHub repositories via OAuth, Google Drive files (Docs, Sheets, Slides,
                PDFs), and uploads up to 8 MiB/file (50 files &amp; 100 MiB/project, 2 GiB total
                under <code className="text-[var(--text-primary)]">/home/antigravity/upload</code>).
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Unsupported in Remote Agent sessions: <code>--print</code>, <code>/codesearch</code>,{' '}
            <code>/diff</code>, <code>/fork</code>, <code>/rewind</code>, <code>/btw</code>,{' '}
            <code>/voice</code>, local <code>!</code> shell commands, <code>@</code> subagent
            mentions, and locally installed MCP servers or desktop skills.
          </p>

          <a
            href={OFFICIAL_DOCS_URLS.remoteAgents}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-violet)] hover:underline"
          >
            <span>Read Official Remote Agents Docs</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </CardContent>
      </Card>

      {/* Troubleshooting & Official Docs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <CardTitle>Troubleshooting &amp; Official Documentation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="divide-y divide-[var(--border-subtle)] text-sm">
            <div className="pb-3 space-y-1">
              <dt className="font-semibold text-[var(--text-primary)]">
                Machine missing in antigravity.google.com
              </dt>
              <dd className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Confirm Enable Remote Control is On, the host is awake and online, and both devices
                use the same Google Account. For CLI daemons, run{' '}
                <code>agy remote-control status</code>; if prompted for sign-in, run <code>agy</code>
                , authenticate, and restart the daemon.
              </dd>
            </div>
            <div className="py-3 space-y-1">
              <dt className="font-semibold text-[var(--text-primary)]">
                Connection drops repeatedly
              </dt>
              <dd className="text-xs leading-relaxed text-[var(--text-secondary)]">
                An older script-installed daemon may be competing. Re-run{' '}
                <code>agy remote-control start</code> to unregister older services cleanly.
              </dd>
            </div>
            <div className="py-3 space-y-1">
              <dt className="font-semibold text-[var(--text-primary)]">
                Two similar machine entries appear
              </dt>
              <dd className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Editor Remote Control (<code>remoteControlHostname</code>) and CLI daemon (
                <code>cliRemoteControlHostname</code>) register separately by design. Rename one in
                settings or config.json.
              </dd>
            </div>
            <div className="pt-3 space-y-1">
              <dt className="font-semibold text-[var(--text-primary)]">
                Account policy or eligibility errors
              </dt>
              <dd className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Google Workspace / Cloud Identity accounts require admin enablement and licensing,
                and personal accounts require 18+ age verification in supported regions.
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2.5 border-t border-[var(--border-subtle)] pt-3.5">
            <a
              href={OFFICIAL_ANTIGRAVITY_BASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <span>antigravity.google.com</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              href={OFFICIAL_DOCS_URLS.remoteControl}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <span>Remote Control Docs</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              href={OFFICIAL_DOCS_URLS.remoteAgents}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <span>Remote Agents Docs</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              href={OFFICIAL_DOCS_URLS.faq}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <span>Official FAQ</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
