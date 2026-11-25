import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Columns3, List, Plus } from 'lucide-react';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskFormSheet } from '../components/tasks/TaskFormSheet';
import { Button } from '../components/ui/Button';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Sheet } from '../components/ui/Sheet';
import { db } from '../db/database';
import { tasksRepo } from '../db/repo';
import { useLive } from '../hooks/useLive';
import { useAppStore } from '../stores/useAppStore';
import { TASK_PRIORITIES, TASK_STATUSES, type TaskItem, type TaskStatus } from '../types/domain';

export function TaskBoardPage() {
  const addToast = useAppStore((s) => s.addToast);
  const trigger = useAppStore((s) => s.quickActionTrigger);
  const clearQuickAction = useAppStore((s) => s.clearQuickAction);

  const tasksQ = useLive(() => db.tasks.toArray(), []);
  const projectsQ = useLive(() => db.projects.toArray(), []);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);

  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [activeStatus, setActiveStatus] = useState<TaskStatus>('Backlog');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskItem | undefined>();
  const [deleting, setDeleting] = useState<TaskItem | undefined>();

  useEffect(() => {
    if (trigger?.action === 'new_task') {
      /* eslint-disable react-hooks/set-state-in-effect */
      setEditing(undefined);
      setFormOpen(true);
      clearQuickAction();
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [trigger, clearQuickAction]);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => !projectFilter || t.projectId === projectFilter)
      .filter((t) => !priorityFilter || t.priority === priorityFilter)
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q)
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [tasks, search, projectFilter, priorityFilter]);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(t: TaskItem) {
    setEditing(t);
    setFormOpen(true);
  }
  async function changeStatus(t: TaskItem, s: TaskStatus) {
    try {
      await tasksRepo.setStatus(t.id, s);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not update status', 'error');
    }
  }
  async function confirmDelete() {
    if (!deleting) return;
    try {
      await tasksRepo.remove(deleting.id);
      addToast('Task deleted', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not delete task', 'error');
    }
    setDeleting(undefined);
  }

  const renderCard = (t: TaskItem) => (
    <TaskCard
      key={t.id}
      task={t}
      project={t.projectId ? projectMap.get(t.projectId) : undefined}
      onEdit={openEdit}
      onDelete={setDeleting}
      onStatus={changeStatus}
    />
  );

  let body;
  if (tasksQ.loading) {
    body = <p role="status" className="text-sm text-[var(--text-secondary)]">Loading tasks…</p>;
  } else if (tasksQ.error) {
    body = (
      <p role="alert" className="text-sm text-[var(--status-danger)]">
        Could not load tasks: {tasksQ.error.message}
      </p>
    );
  } else if (tasks.length === 0) {
    body = (
      <EmptyState
        icon={<CheckSquare className="h-5 w-5" aria-hidden="true" />}
        title="No tasks yet"
        description="Create a personal task to plan work around your Antigravity sessions."
        action={<Button onClick={openCreate}>New task</Button>}
      />
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        title="No matching tasks"
        description="No tasks match the current filters or search."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setProjectFilter('');
              setPriorityFilter('');
            }}
          >
            Clear filters
          </Button>
        }
      />
    );
  } else if (view === 'list') {
    body = (
      <div data-testid="task-list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.map(renderCard)}
      </div>
    );
  } else {
    body = (
      <div data-testid="task-kanban" className="space-y-3">
        <div role="tablist" aria-label="Task status" className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 md:hidden">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={activeStatus === s}
              onClick={() => setActiveStatus(s)}
              className={`touch-target rounded-xl border px-2 py-2 text-xs font-medium cursor-pointer ${
                activeStatus === s
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-blue-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {s} ({filtered.filter((t) => t.status === s).length})
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {TASK_STATUSES.map((s) => {
            const col = filtered.filter((t) => t.status === s);
            return (
              <section
                key={s}
                aria-label={`${s} column`}
                data-testid={`column-${s}`}
                className={`min-w-0 space-y-2.5 ${activeStatus === s ? '' : 'hidden'} md:block`}
              >
                <h2 className="hidden text-sm font-semibold md:block">
                  {s} <span className="text-[var(--text-muted)]">({col.length})</span>
                </h2>
                {col.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No tasks</p>
                ) : (
                  col.map(renderCard)
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Task Board</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Personal local task board for planning work around your Antigravity sessions.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" /> New task
        </Button>
      </header>

      <DisclosureBanner variant="warning" title="Manual personal tracker">
        Personal local tracker — manually updated, not synced with live Antigravity agent state. Statuses here are
        never read from or written to Antigravity.
      </DisclosureBanner>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Search"
          type="search"
          placeholder="Search tasks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select label="Project filter" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
        <Select label="Priority filter" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2" role="group" aria-label="View mode">
        <Button variant={view === 'list' ? 'primary' : 'secondary'} size="sm" aria-pressed={view === 'list'} onClick={() => setView('list')}>
          <List className="h-4 w-4" aria-hidden="true" /> List
        </Button>
        <Button variant={view === 'kanban' ? 'primary' : 'secondary'} size="sm" aria-pressed={view === 'kanban'} onClick={() => setView('kanban')}>
          <Columns3 className="h-4 w-4" aria-hidden="true" /> Kanban
        </Button>
      </div>

      {body}

      <TaskFormSheet open={formOpen} task={editing} projects={projects} onClose={() => setFormOpen(false)} />

      <Sheet open={!!deleting} onClose={() => setDeleting(undefined)} title="Delete task?">
        <p className="text-sm text-[var(--text-secondary)]">
          “{deleting?.title}” will be permanently removed from this device.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setDeleting(undefined)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Confirm delete
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
