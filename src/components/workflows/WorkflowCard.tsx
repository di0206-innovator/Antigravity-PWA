import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Copy, Pencil, Send, Trash2 } from 'lucide-react';
import type { WorkflowEntry } from '../../types/domain';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface WorkflowCardProps {
  workflow: WorkflowEntry;
  onEdit: (w: WorkflowEntry) => void;
  onDelete: (w: WorkflowEntry) => void;
  onCopy: (w: WorkflowEntry) => void;
  onUse: (w: WorkflowEntry) => void;
}

export function WorkflowCard({ workflow: w, onEdit, onDelete, onCopy, onUse }: WorkflowCardProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const panelId = `workflow-detail-${w.id}`;
  return (
    <Card className="p-4 space-y-3" aria-label={w.title}>
      <div className="space-y-1 min-w-0">
        <h3 className="text-base font-semibold break-words">{w.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="info">{w.category}</Badge>
          {w.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      </div>
      {w.description ? (
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">{w.description}</p>
      ) : null}
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Hide' : 'Show'} details for ${w.title}`} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        {open ? 'Hide details' : 'Show details'}
        
      </Button>
      {open ? (
        <div id={panelId} className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Steps</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
              {w.steps.map((s, i) => (
                <li key={i} className="break-words">{s}</li>
              ))}
            </ol>
          </div>
          {w.relatedSkills.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold">Related skills</h4>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {w.relatedSkills.map((s) => (
                  <Link key={s} to="/skills" className="touch-target inline-flex items-center">
                    <Badge tone="violet">{s}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {w.copyablePrompt ? (
            <div>
              <h4 className="text-sm font-semibold">Prompt</h4>
              <p className="mt-1 rounded-xl bg-[var(--bg-elevated)] p-3 text-sm whitespace-pre-wrap break-words">{w.copyablePrompt}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => onCopy(w)} aria-label={`Copy prompt for ${w.title}`}>
          <Copy className="h-4 w-4" aria-hidden="true" /> Copy prompt
        </Button>
        <Button size="sm" onClick={() => onUse(w)} aria-label={`Use ${w.title} in Prompt Studio`}>
          <Send className="h-4 w-4" aria-hidden="true" /> Use in Prompt Studio
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(w)} aria-label={`Edit ${w.title}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Delete ${w.title}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </Button>
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label={`Confirm delete ${w.title}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--status-danger)] p-3 text-sm">
          <span className="min-w-0 break-words">Delete this workflow? This cannot be undone.</span>
          <Button variant="danger" size="sm" onClick={() => onDelete(w)}>Confirm delete</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : null}
    </Card>
  );
}
