import { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '../../db/database';
import { promptsRepo } from '../../db/repo';
import { useLive } from '../../hooks/useLive';
import { useAppStore } from '../../stores/useAppStore';
import type { PromptTemplate } from '../../types/domain';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Sheet } from '../ui/Sheet';

export interface TemplateSheetProps {
  open: boolean;
  onClose: () => void;
  onUse: (t: PromptTemplate, mode: 'replace' | 'append') => void;
  onEdit: (t: PromptTemplate) => void;
  onDeleted: (id: string) => void;
}

export function TemplateSheet({ open, onClose, onUse, onEdit, onDeleted }: TemplateSheetProps) {
  const addToast = useAppStore((s) => s.addToast);
  const { data, loading, error } = useLive(() => db.prompts.orderBy('updatedAt').reverse().toArray(), []);
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleClose = () => {
    setConfirmId(null);
    onClose();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.tags.some((g) => g.toLowerCase().includes(q))
    );
  }, [data, query]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      addToast(ok, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    }
  };

  return (
    <Sheet open={open} onClose={handleClose} title="Prompt templates" description="Insert, edit, duplicate or delete saved templates.">
      <div className="space-y-3">
        <Input
          label="Search templates"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, tag or text"
        />
        {error ? (
          <p role="alert" className="text-sm text-[var(--status-danger)]">
            Could not load templates.
          </p>
        ) : loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading templates…</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="No templates found" description="Try a different search, or save the current prompt as a template." />
        ) : (
          <ul className="space-y-2">
            {filtered.map((t) => (
              <li key={t.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] break-words min-w-0">{t.title}</h3>
                  {t.isStarter ? <Badge tone="info">Starter</Badge> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)] break-words">{t.body}</p>
                {t.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.tags.map((g) => (
                      <Badge key={g}>{g}</Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setConfirmId(null);
                      onUse(t, 'replace');
                    }}
                    aria-label={`Use template ${t.title}`}
                  >
                    Use
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setConfirmId(null);
                      onUse(t, 'append');
                    }}
                    aria-label={`Append template ${t.title}`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Append
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConfirmId(null);
                      onEdit(t);
                    }}
                    aria-label={`Edit template ${t.title}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Duplicate template ${t.title}`}
                    onClick={() => void run(() => promptsRepo.duplicate(t.id), 'Template duplicated')}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" /> Duplicate
                  </Button>
                  {confirmId === t.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="danger"
                        aria-label={`Confirm delete ${t.title}`}
                        onClick={() =>
                          void run(async () => {
                            await promptsRepo.remove(t.id);
                            onDeleted(t.id);
                            setConfirmId(null);
                          }, 'Template deleted')
                        }
                      >
                        Confirm delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" aria-label={`Delete template ${t.title}`} onClick={() => setConfirmId(t.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
