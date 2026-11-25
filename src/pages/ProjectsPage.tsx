import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import { DeleteProjectSheet } from '../components/projects/DeleteProjectSheet';
import { ProjectAvatar } from '../components/projects/ProjectAvatar';
import { ProjectFormSheet } from '../components/projects/ProjectFormSheet';
import { sortProjects } from '../components/projects/projectUtils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { db } from '../db/database';
import { projectsRepo } from '../db/repo';
import { useLive } from '../hooks/useLive';
import { useAppStore } from '../stores/useAppStore';
import { PROJECT_CATEGORIES, type Project } from '../types/domain';

export function ProjectsPage() {
  const addToast = useAppStore((s) => s.addToast);
  const quickActionTrigger = useAppStore((s) => s.quickActionTrigger);
  const clearQuickAction = useAppStore((s) => s.clearQuickAction);
  const { data, loading, error } = useLive(() => db.projects.toArray());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const [seenNonce, setSeenNonce] = useState<number | null>(null);
  if (quickActionTrigger && quickActionTrigger.nonce !== seenNonce) {
    setSeenNonce(quickActionTrigger.nonce);
    if (quickActionTrigger.action === 'new_project') {
      setEditing(null);
      setFormOpen(true);
    }
  }
  useEffect(() => {
    if (quickActionTrigger?.action === 'new_project') clearQuickAction();
  }, [quickActionTrigger, clearQuickAction]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortProjects(data ?? []).filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!q || [p.title, p.machineName, p.workspaceLabel, p.description].some((v) => v.toLowerCase().includes(q)))
    );
  }, [data, query, category]);

  const total = data?.length ?? 0;

  async function togglePin(p: Project) {
    try {
      await projectsRepo.setPinned(p.id, !p.pinned);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not update pin.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Organize local Antigravity workspaces, machine names, and official session URLs.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> New project
        </Button>
      </header>

      <DisclosureBanner title="Local workspace organizer">
        Projects are personal records stored on this device. Nothing here reflects live Antigravity status.
      </DisclosureBanner>

      {total > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Input
              label="Search projects"
              type="search"
              value={query}
              placeholder="Title, machine, workspace…"
              onChange={(e) => setQuery(e.target.value)}
            />
            <Search className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          </div>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {PROJECT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--status-danger)]">
          Could not load projects.
        </p>
      ) : loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading projects…</p>
      ) : total === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" aria-hidden="true" />}
          title="No projects yet"
          description="Create a project to track a workspace, the machine it runs on, and its official Antigravity session link."
          action={<Button onClick={() => setFormOpen(true)}>Create your first project</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title="No matching projects"
          description="Try a different search term or category."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setCategory('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <Card className="p-3.5">
                <div className="flex items-start gap-3">
                  <ProjectAvatar project={p} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/projects/${p.id}`}
                      className="block min-h-[44px] break-words text-base font-semibold leading-snug hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="violet">{p.category}</Badge>
                      {p.pinned ? <Badge tone="info">Pinned</Badge> : null}
                      {p.officialUrl ? <Badge tone="success">URL saved</Badge> : <Badge>No URL</Badge>}
                    </div>
                    {p.machineName || p.workspaceLabel ? (
                      <p className="mt-1.5 break-words text-xs text-[var(--text-secondary)]">
                        {[p.machineName, p.workspaceLabel].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={p.pinned ? `Unpin ${p.title}` : `Pin ${p.title}`}
                    onClick={() => togglePin(p)}
                  >
                    {p.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${p.title}`}
                    onClick={() => {
                      setEditing(p);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${p.title}`} onClick={() => setDeleting(p)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ProjectFormSheet open={formOpen} project={editing} onClose={() => setFormOpen(false)} />
      <DeleteProjectSheet project={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
