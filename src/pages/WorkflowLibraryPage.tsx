import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus } from 'lucide-react';
import { db } from '../db/database';
import { workflowsRepo } from '../db/repo';
import { useLive } from '../hooks/useLive';
import { useAppStore } from '../stores/useAppStore';
import { WORKFLOW_CATEGORIES, type WorkflowEntry } from '../types/domain';
import { copyWithFeedback, errorIssues } from '../components/skills/copyText';
import { WorkflowCard } from '../components/workflows/WorkflowCard';
import { WorkflowForm } from '../components/workflows/WorkflowForm';
import { Button } from '../components/ui/Button';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Sheet } from '../components/ui/Sheet';

function promptFor(w: WorkflowEntry): string {
  return w.copyablePrompt || w.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

export function WorkflowLibraryPage() {
  const navigate = useNavigate();
  const addToast = useAppStore((s) => s.addToast);
  const queuePromptInjection = useAppStore((s) => s.queuePromptInjection);
  const { data: workflows, loading } = useLive(() => db.workflows.toArray(), []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowEntry | undefined>();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (workflows ?? [])
      .filter((w) => category === 'all' || w.category === category)
      .filter(
        (w) =>
          !q ||
          [w.title, w.description, w.category, w.copyablePrompt, ...w.tags, ...w.steps, ...w.relatedSkills]
            .join('\n')
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [workflows, search, category]);

  const groups = WORKFLOW_CATEGORIES.map((c) => ({ c, items: filtered.filter((w) => w.category === c) })).filter(
    (g) => g.items.length > 0
  );

  const openSheet = (w?: WorkflowEntry) => {
    setEditing(w);
    setSheetOpen(true);
  };
  const total = workflows?.length ?? 0;

  return (
    <div className="space-y-4 min-w-0">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Workflow Library</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Reusable step lists and prompts you maintain locally.
          </p>
        </div>
        <Button onClick={() => openSheet()}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New workflow
        </Button>
      </header>

      <DisclosureBanner title="Local reference only">
        Workflows are manually maintained notes. Copying a prompt only places text on your clipboard; nothing is
        sent to Antigravity.
      </DisclosureBanner>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Search workflows"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title, tag, or text"
        />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {WORKFLOW_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading workflows...</p>
      ) : total === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-5 w-5" aria-hidden="true" />}
          title="No workflows yet"
          description="Create a workflow to keep reusable steps and prompts handy."
          action={<Button onClick={() => openSheet()}>Create a workflow</Button>}
        />
      ) : groups.length === 0 ? (
        <EmptyState title="No matching workflows" description="Try a different search or category." />
      ) : (
        groups.map((g) => (
          <section key={g.c} aria-labelledby={`wf-group-${g.c}`} className="space-y-3">
            <h2 id={`wf-group-${g.c}`} className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {g.c}
            </h2>
            <ul className="space-y-3">
              {g.items.map((w) => (
                <li key={w.id} className="min-w-0">
                  <WorkflowCard
                    workflow={w}
                    onEdit={openSheet}
                    onDelete={async (x) => {
                      try {
                        await workflowsRepo.remove(x.id);
                        addToast('Workflow deleted.', 'success');
                      } catch (e) {
                        addToast(errorIssues(e).join(' '), 'error');
                      }
                    }}
                    onCopy={(x) => void copyWithFeedback(promptFor(x), `prompt for "${x.title}"`)}
                    onUse={(x) => {
                      queuePromptInjection({
                        source: 'workflow',
                        mode: 'append',
                        title: x.title,
                        body: promptFor(x),
                        tags: x.tags,
                      });
                      navigate('/prompts');
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? 'Edit workflow' : 'New workflow'}>
        <WorkflowForm workflow={editing} onDone={() => setSheetOpen(false)} />
      </Sheet>
    </div>
  );
}
