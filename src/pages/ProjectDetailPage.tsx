import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Pencil, Pin, PinOff, Send, Trash2 } from 'lucide-react';
import { DeleteProjectSheet } from '../components/projects/DeleteProjectSheet';
import { ProjectAvatar } from '../components/projects/ProjectAvatar';
import { ProjectFormSheet } from '../components/projects/ProjectFormSheet';
import { buildProjectContext, formatDate } from '../components/projects/projectUtils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { logActivity } from '../db/activityService';
import { db } from '../db/database';
import { projectsRepo } from '../db/repo';
import { useLive } from '../hooks/useLive';
import { OFFICIAL_ANTIGRAVITY_BASE_URL, openOfficialUrl } from '../services/security';
import { useAppStore } from '../stores/useAppStore';
import type { TaskStatus, WorkflowEntry } from '../types/domain';

const linkBtn =
  'touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]';

function statusTone(s: TaskStatus) {
  if (s === 'Completed') return 'success' as const;
  if (s === 'In Progress') return 'info' as const;
  if (s === 'Needs Attention') return 'warning' as const;
  return 'neutral' as const;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useAppStore((s) => s.addToast);
  const queuePromptInjection = useAppStore((s) => s.queuePromptInjection);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const project = useLive(() => (id ? db.projects.get(id) : undefined), [id]);
  const prompts = useLive(() => (id ? db.prompts.where('projectId').equals(id).toArray() : []), [id]);
  const tasks = useLive(() => (id ? db.tasks.where('projectId').equals(id).toArray() : []), [id]);
  const skills = useLive(() => db.skills.filter(s => s.isFavorite).toArray(), []);
  const workflows = useLive(() => db.workflows.orderBy('title').toArray(), []);

  if (project.error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-[var(--status-danger)]">
          Could not load project: {project.error.message}
        </p>
        <Link to="/projects" className={linkBtn}>
          Back to Projects
        </Link>
      </div>
    );
  }

  if (project.loading) return <p className="text-sm text-[var(--text-secondary)]">Loading project…</p>;

  const p = project.data;
  if (!p) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Project not found"
          description="This project does not exist on this device. It may have been deleted."
          action={
            <Link to="/projects" className={linkBtn}>
              Back to Projects
            </Link>
          }
        />
      </div>
    );
  }

  function openProject() {
    if (!p) return;
    const r = openOfficialUrl(p.officialUrl);
    if (!r.opened) {
      addToast(r.error ?? 'Could not open URL.', 'error');
      return;
    }
    void logActivity(
      {
        category: 'project',
        description: `Opened saved official Antigravity project URL for "${p.title}"`,
        projectId: p.id,
      }
    ).catch(() => undefined);
  }

  function openBase() {
    if (!p) return;
    const r = openOfficialUrl(OFFICIAL_ANTIGRAVITY_BASE_URL);
    if (!r.opened) {
      addToast(r.error ?? 'Could not open Antigravity.', 'error');
      return;
    }
    void logActivity(
      {
        category: 'project',
        description: `Opened official Antigravity from project "${p.title}"`,
        projectId: p.id,
      }
    ).catch(() => undefined);
  }

  function sendWorkflowToStudio(w: WorkflowEntry) {
    if (!p) return;
    const body = w.copyablePrompt || w.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    queuePromptInjection({
      source: 'workflow',
      mode: 'append',
      title: `${p.title} — ${w.title}`,
      body,
      tags: w.tags,
    });
    navigate('/prompts');
  }

  return (
    <div className="space-y-4">
      <Link to="/projects" className="inline-flex min-h-[44px] items-center text-sm text-[var(--accent-primary)]">
        &larr; All projects
      </Link>

      <header className="flex items-start gap-3">
        <ProjectAvatar project={p} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="break-words text-2xl font-bold tracking-tight">{p.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="violet">{p.category}</Badge>
            {p.pinned ? <Badge tone="info">Pinned</Badge> : null}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Last manually updated: {formatDate(p.updatedAt)}</p>
        </div>
      </header>

      <DisclosureBanner>
        Personal records only. Nothing on this page reflects live Antigravity status.
      </DisclosureBanner>

      <Card>
        <CardHeader>
          <CardTitle>Antigravity session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.officialUrl ? (
            <>
              <p className="break-all text-sm text-[var(--text-secondary)]">{p.officialUrl}</p>
              <Button size="lg" className="w-full" onClick={openProject}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> OPEN PROJECT IN ANTIGRAVITY
              </Button>
            </>
          ) : (
            <>
              <EmptyState
                title="No session URL saved"
                description="Edit this project and paste the official https://antigravity.google.com session URL you copied from Antigravity. AG Pocket never builds links for you."
                action={<Button variant="secondary" onClick={() => setEditOpen(true)}>Add URL</Button>}
              />
              <Button variant="outline" className="w-full" onClick={openBase}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open Antigravity
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-[var(--text-muted)]">Machine</dt>
              <dd className="break-words">{p.machineName || 'Not set'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-[var(--text-muted)]">Workspace</dt>
              <dd className="break-words">{p.workspaceLabel || 'Not set'}</dd>
            </div>
          </dl>
          <div>
            <h3 className="text-xs text-[var(--text-muted)]">Description</h3>
            <p className="whitespace-pre-wrap break-words">{p.description || 'No description.'}</p>
          </div>
          <div>
            <h3 className="text-xs text-[var(--text-muted)]">Personal notes</h3>
            <p className="whitespace-pre-wrap break-words">{p.notes || 'No notes.'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          onClick={() => {
            queuePromptInjection({ source: 'project', mode: 'append', body: buildProjectContext(p) });
            navigate('/prompts');
          }}
        >
          <Send className="h-4 w-4" aria-hidden="true" /> Send project context to Prompt Studio
        </Button>
        <Button
          variant="secondary"
          onClick={() => projectsRepo.setPinned(p.id, !p.pinned).catch((e) => addToast(String(e.message ?? e), 'error'))}
        >
          {p.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
          {p.pinned ? 'Unpin' : 'Pin'}
        </Button>
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
        </Button>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project tasks</CardTitle>
          <CardDescription>
            Tasks are user-maintained notes and are not synced with Antigravity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.error ? (
            <p role="alert" className="text-sm text-[var(--status-danger)]">
              Could not load tasks.
            </p>
          ) : (tasks.data ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No tasks linked to this project.</p>
          ) : (
            <ul className="space-y-2">
              {(tasks.data ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">{t.title}</span>
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link to="/tasks" className={linkBtn}>
            Open Task Board
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Associated prompts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {prompts.error ? (
            <p role="alert" className="text-sm text-[var(--status-danger)]">
              Could not load prompts.
            </p>
          ) : (prompts.data ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No prompts linked to this project.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {(prompts.data ?? []).map((pr) => (
                <li key={pr.id} className="break-words">
                  {pr.title}
                </li>
              ))}
            </ul>
          )}
          <Link to="/prompts" className={linkBtn}>
            Open Prompt Studio
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suggested skills</CardTitle>
          <CardDescription>Your favourite skills. Skills are not tied to individual projects.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {skills.error ? (
            <p role="alert" className="text-sm text-[var(--status-danger)]">
              Could not load skills.
            </p>
          ) : (skills.data ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No favourite skills yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {(skills.data ?? []).map((s) => (
                <li key={s.id} className="break-words">
                  {s.name}
                </li>
              ))}
            </ul>
          )}
          <Link to="/skills" className={linkBtn}>
            Browse Skills
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow templates</CardTitle>
          <CardDescription>Reusable checklists you can copy into a prompt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {workflows.error ? (
            <p role="alert" className="text-sm text-[var(--status-danger)]">
              Could not load workflows.
            </p>
          ) : (workflows.data ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No workflow templates saved yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(workflows.data ?? []).slice(0, 5).map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="break-words font-medium">{w.title}</span>{' '}
                    <Badge tone="neutral">{w.category}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Use workflow ${w.title} in Prompt Studio`}
                    onClick={() => sendWorkflowToStudio(w)}
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" /> Use in Studio
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/workflows" className={linkBtn}>
            Open Workflow Library
          </Link>
        </CardContent>
      </Card>

      <ProjectFormSheet open={editOpen} project={p} onClose={() => setEditOpen(false)} />
      <DeleteProjectSheet
        project={deleteOpen ? p : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/projects')}
      />
    </div>
  );
}
