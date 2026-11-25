import { useMemo, useState } from 'react';
import { Activity, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';
import { Sheet } from '../components/ui/Sheet';
import { clearActivityLog } from '../db/activityService';
import { db } from '../db/database';
import { useLive } from '../hooks/useLive';
import { useAppStore } from '../stores/useAppStore';
import { ACTIVITY_CATEGORIES, type ActivityCategory } from '../types/domain';

function dayKey(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ActivityLogPage() {
  const addToast = useAppStore((s) => s.addToast);
  const logQ = useLive(() => db.activityLog.orderBy('timestamp').reverse().toArray(), []);
  const projectsQ = useLive(() => db.projects.toArray(), []);
  const [category, setCategory] = useState<'' | ActivityCategory>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const projectMap = useMemo(() => new Map((projectsQ.data ?? []).map((p) => [p.id, p.title])), [projectsQ.data]);
  const entries = useMemo(
    () => (logQ.data ?? []).filter((e) => !category || e.category === category),
    [logQ.data, category]
  );
  const groups = useMemo(() => {
    const m = new Map<string, typeof entries>();
    for (const e of entries) {
      const k = dayKey(e.timestamp);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [entries]);

  async function clear() {
    try {
      await clearActivityLog();
      addToast('Activity history cleared', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not clear history', 'error');
    }
    setConfirmOpen(false);
  }

  const total = logQ.data?.length ?? 0;
  let body;
  if (logQ.loading) body = <p role="status" className="text-sm text-[var(--text-secondary)]">Loading activity…</p>;
  else if (logQ.error)
    body = (
      <p role="alert" className="text-sm text-[var(--status-danger)]">
        Could not load activity: {logQ.error.message}
      </p>
    );
  else if (entries.length === 0)
    body = (
      <EmptyState
        icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        title={total === 0 ? 'No activity yet' : 'No matching activity'}
        description={
          total === 0
            ? 'Actions you take inside AG Pocket will appear here.'
            : 'No entries match the selected category.'
        }
      />
    );
  else
    body = (
      <div className="space-y-5">
        {groups.map(([day, list]) => (
          <section key={day} aria-label={`Activity on ${day}`} className="space-y-2">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
              {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h2>
            <ul className="space-y-2">
              {list.map((e) => (
                <li
                  key={e.id}
                  className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
                >
                  <p className="break-words text-sm">{e.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <time dateTime={e.timestamp} className="text-xs text-[var(--text-muted)]">
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <Badge tone="info">{e.category}</Badge>
                    {e.projectId && projectMap.get(e.projectId) ? (
                      <Badge tone="violet">{projectMap.get(e.projectId)}</Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Chronological local record of actions taken inside AG Pocket.
          </p>
        </div>
        <Button variant="danger" className="shrink-0" disabled={total === 0} onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear history
        </Button>
      </header>

      <DisclosureBanner title="Local only">
        This log only records actions taken inside AG Pocket. It does not show Antigravity agent activity.
      </DisclosureBanner>

      <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as '' | ActivityCategory)}>
        <option value="">All categories</option>
        {ACTIVITY_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      {body}

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Clear activity history?">
        <p className="text-sm text-[var(--text-secondary)]">
          All local activity entries will be permanently removed from this device.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={clear}>
            Confirm clear
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
