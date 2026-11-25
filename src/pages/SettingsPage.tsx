import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  Lock,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { logActivity } from '../db/activityService';
import {
  clearAllLocalData,
  exportLocalData,
  importLocalData,
  MAX_IMPORT_BYTES,
  serializeExportBundle,
} from '../db/backup';
import { useHaptics } from '../hooks/useHaptics';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { officialIntegrationAdapter } from '../services/officialAdapter';
import { useAppStore } from '../stores/useAppStore';
import type { ImportResult } from '../types/domain';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { Sheet } from '../components/ui/Sheet';

export function SettingsPage() {
  const theme = useAppStore((s) => s.theme);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const setTheme = useAppStore((s) => s.setTheme);
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);
  const setHapticsEnabled = useAppStore((s) => s.setHapticsEnabled);
  const initializeApp = useAppStore((s) => s.initializeApp);
  const addToast = useAppStore((s) => s.addToast);

  const { supported: hapticsSupported, triggerHaptic } = useHaptics();
  const { canInstallPrompt, isStandalone, isIosSafari, isAndroid, triggerInstall } =
    usePwaInstall();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [clearSheetOpen, setClearSheetOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const adapterCapabilities = officialIntegrationAdapter.getCapabilities();

  const handleThemeChange = async (nextTheme: 'dark' | 'light') => {
    triggerHaptic('light');
    await setTheme(nextTheme);
  };

  const handleToggleReducedMotion = async () => {
    const next = !reducedMotion;
    await setReducedMotion(next);
    if (!next) triggerHaptic('light');
  };

  const handleToggleHaptics = async () => {
    const next = !hapticsEnabled;
    await setHapticsEnabled(next);
    if (next && hapticsSupported) {
      triggerHaptic('light');
    }
  };

  const handleInstallClick = async () => {
    triggerHaptic('medium');
    const outcome = await triggerInstall();
    if (outcome === 'accepted') {
      addToast('AG Pocket installation started.', 'success');
    } else if (outcome === 'dismissed') {
      addToast('Install prompt dismissed. You can install anytime from browser menu.', 'info');
    } else {
      addToast('Use your browser install steps below to add AG Pocket to your home screen.', 'info');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const bundle = await exportLocalData();
      const json = serializeExportBundle(bundle);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `ag-pocket-backup-${dateStr}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      triggerHaptic('success');
      addToast('Local backup exported as JSON.', 'success');
      void logActivity({
        category: 'system',
        description: 'Exported local AG Pocket data bundle as JSON',
      }).catch(() => {});
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to export local data.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportErrors([]);
    setImportResult(null);

    if (file.size > MAX_IMPORT_BYTES) {
      setImportErrors([
        `Selected file exceeds the ${MAX_IMPORT_BYTES / (1024 * 1024)} MiB import limit.`,
      ]);
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importLocalData(text);
      if (!result.ok) {
        setImportErrors(result.errors);
        addToast('Import validation failed. Existing local data was not modified.', 'error');
        return;
      }

      await initializeApp();
      setImportResult(result);
      triggerHaptic('success');
      addToast('Backup imported successfully.', 'success');
    } catch (err) {
      setImportErrors([
        err instanceof Error ? err.message : 'Unable to read or import the selected JSON file.',
      ]);
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmClearAll = async () => {
    setClearing(true);
    try {
      await clearAllLocalData();
      await initializeApp();
      setImportResult(null);
      setImportErrors([]);
      setClearSheetOpen(false);
      triggerHaptic('warning');
      addToast('All local data cleared.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to clear local data.', 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Customize theme, accessibility ergonomics, PWA installation, and local backup data.
        </p>
      </header>

      {/* Appearance & Ergonomics */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance &amp; Ergonomics</CardTitle>
          <CardDescription>
            OLED dark mode is active by default. All preferences persist locally in IndexedDB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
            <div className="grid grid-cols-2 gap-2.5 max-w-sm">
              <Button
                variant={theme === 'dark' ? 'primary' : 'outline'}
                aria-pressed={theme === 'dark'}
                onClick={() => void handleThemeChange('dark')}
              >
                <Moon className="h-4 w-4" aria-hidden="true" />
                <span>OLED Dark</span>
              </Button>
              <Button
                variant={theme === 'light' ? 'primary' : 'outline'}
                aria-pressed={theme === 'light'}
                onClick={() => void handleThemeChange('light')}
              >
                <Sun className="h-4 w-4" aria-hidden="true" />
                <span>Light</span>
              </Button>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] pt-3">
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 space-y-0.5">
                <p id="reduced-motion-label" className="text-sm font-medium text-[var(--text-primary)]">
                  Reduced motion
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Minimizes transitions and disables haptic vibration cues.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                aria-labelledby="reduced-motion-label"
                onClick={() => void handleToggleReducedMotion()}
                className={`touch-target inline-flex items-center justify-center rounded-xl border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  reducedMotion
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-solid)] text-[var(--accent-primary-fg)]'
                    : 'border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}
              >
                {reducedMotion ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3">
              <div className="min-w-0 space-y-0.5">
                <p id="haptics-label" className="text-sm font-medium text-[var(--text-primary)]">
                  Browser haptics
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Uses standard browser <code>navigator.vibrate</code> only when supported (
                  {hapticsSupported ? 'available in this browser' : 'not supported on this device'}).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hapticsEnabled}
                aria-labelledby="haptics-label"
                onClick={() => void handleToggleHaptics()}
                className={`touch-target inline-flex items-center justify-center rounded-xl border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  hapticsEnabled
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-solid)] text-[var(--accent-primary-fg)]'
                    : 'border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}
              >
                {hapticsEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PWA Installation & Platform Guides */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
              <CardTitle>Install AG Pocket (PWA)</CardTitle>
            </div>
            <Badge tone={isStandalone ? 'success' : 'neutral'}>
              {isStandalone ? 'Installed (Standalone)' : 'Browser Tab'}
            </Badge>
          </div>
          <CardDescription>
            Install AG Pocket to your mobile home screen for standalone full-screen launch and
            offline local workspace access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canInstallPrompt ? (
            <Button onClick={() => void handleInstallClick()}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Install AG Pocket</span>
            </Button>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className={`rounded-xl border p-3.5 space-y-2 ${
                isAndroid
                  ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-blue-soft)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Android (Chrome / Edge)
                </p>
                {isAndroid ? <Badge tone="info">Detected</Badge> : null}
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                <li>Open AG Pocket in Chrome or Microsoft Edge.</li>
                <li>Tap the Install prompt banner or open the browser menu (three dots).</li>
                <li>Select &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</li>
                <li>Confirm to launch AG Pocket in standalone mode.</li>
              </ol>
            </div>

            <div
              className={`rounded-xl border p-3.5 space-y-2 ${
                isIosSafari
                  ? 'border-[var(--accent-violet)]/50 bg-[var(--accent-violet-soft)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">iOS (Safari)</p>
                {isIosSafari ? <Badge tone="violet">Detected</Badge> : null}
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                <li>Open AG Pocket in Safari on iPhone or iPad.</li>
                <li>Tap the Share icon in the Safari toolbar.</li>
                <li>Scroll down and tap &ldquo;Add to Home Screen&rdquo;.</li>
                <li>Tap &ldquo;Add&rdquo; to enable standalone layout and safe-area insets.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Local Data Export / Import & Clear All */}
      <Card>
        <CardHeader>
          <CardTitle>Local Data Backup &amp; Reset</CardTitle>
          <CardDescription>
            Export your entire IndexedDB database as validated JSON, restore backups with duplicate
            prevention, or wipe all local data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => void handleExport()} disabled={exporting}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{exporting ? 'Exporting...' : 'Export Local Data (JSON)'}</span>
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              aria-label="Import local data JSON file"
              onChange={(e) => void handleFileSelected(e)}
              className="sr-only"
            />
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>{importing ? 'Importing...' : 'Import Local Data (JSON)'}</span>
            </Button>

            <Button variant="danger" onClick={() => setClearSheetOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear All Local Data</span>
            </Button>
          </div>

          {importErrors.length > 0 ? (
            <div
              role="alert"
              className="rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] p-3.5 space-y-1.5"
            >
              <p className="text-sm font-semibold text-[var(--status-danger)]">
                Import rejected — existing data unchanged
              </p>
              <ul className="list-disc list-inside text-xs text-[var(--text-primary)] space-y-0.5">
                {importErrors.map((err, index) => (
                  <li key={`${err}-${index}`}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {importResult ? (
            <div
              role="status"
              className="rounded-xl border border-[var(--status-ok)]/40 bg-[var(--status-ok-bg)] p-3.5 space-y-1.5 text-xs"
            >
              <p className="text-sm font-semibold text-[var(--status-ok)]">Import summary</p>
              <p className="text-[var(--text-primary)]">
                Imported: {importResult.importedCounts.projects} projects,{' '}
                {importResult.importedCounts.prompts} prompts, {importResult.importedCounts.skills}{' '}
                skills, {importResult.importedCounts.workflows} workflows,{' '}
                {importResult.importedCounts.tasks} tasks.
              </p>
              <p className="text-[var(--text-secondary)]">
                Skipped duplicates: {importResult.skippedDuplicates.projects} projects,{' '}
                {importResult.skippedDuplicates.prompts} prompts,{' '}
                {importResult.skippedDuplicates.skills} skills,{' '}
                {importResult.skippedDuplicates.workflows} workflows,{' '}
                {importResult.skippedDuplicates.tasks} tasks.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Disabled Future Integration Adapter + Privacy Link */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[var(--accent-violet)]" aria-hidden="true" />
              <CardTitle>Official Integration Adapter</CardTitle>
            </div>
            <Badge tone="neutral">Disabled</Badge>
          </div>
          <CardDescription>
            Adapter ID: <code>{officialIntegrationAdapter.id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DisclosureBanner title="Future integration boundary">
            {adapterCapabilities.reason}
          </DisclosureBanner>
          <p className="text-xs text-[var(--text-secondary)]">
            Permitted actions: {adapterCapabilities.permittedActions.join(', ')}.
          </p>
          <Link
            to="/privacy"
            className="touch-target inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>Open Privacy &amp; Security Policy</span>
          </Link>
        </CardContent>
      </Card>

      {/* Two-step Clear All Local Data Confirmation Sheet */}
      <Sheet
        open={clearSheetOpen}
        onClose={() => setClearSheetOpen(false)}
        title="Clear All Local Data"
        description="This permanently deletes all projects, custom prompts, skills, workflows, tasks, and activity logs from this browser."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] p-3.5 text-sm">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-danger)]"
              aria-hidden="true"
            />
            <p className="text-[var(--text-primary)] leading-relaxed">
              Export a JSON backup first if you want to keep your records. Starter templates and
              default settings will remain reset.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Button
              variant="danger"
              className="flex-1"
              disabled={clearing}
              onClick={() => void handleConfirmClearAll()}
            >
              {clearing ? 'Clearing...' : 'Confirm Clear All Data'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={clearing}
              onClick={() => setClearSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
