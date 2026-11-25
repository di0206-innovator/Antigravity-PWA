import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Pencil, Send, Star, Trash2 } from 'lucide-react';
import type { SkillEntry } from '../../types/domain';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface SkillCardProps {
  skill: SkillEntry;
  onToggleFavorite: (s: SkillEntry) => void;
  onEdit: (s: SkillEntry) => void;
  onDelete: (s: SkillEntry) => void;
  onCopy: (s: SkillEntry) => void;
  onUse: (s: SkillEntry) => void;
}

export function SkillCard({ skill, onToggleFavorite, onEdit, onDelete, onCopy, onUse }: SkillCardProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const panelId = `skill-detail-${skill.id}`;
  return (
    <Card className="p-4 space-y-3" aria-label={skill.name}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-semibold break-words">{skill.name}</h2>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="info">{skill.category}</Badge>
            {skill.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={skill.isFavorite}
          aria-label={skill.isFavorite ? `Remove ${skill.name} from favourites` : `Add ${skill.name} to favourites`}
          onClick={() => onToggleFavorite(skill)}
        >
          <Star className={`h-5 w-5 ${skill.isFavorite ? 'fill-current text-[var(--status-warn)]' : ''}`} aria-hidden="true" />
        </Button>
      </div>
      {skill.description ? (
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">{skill.description}</p>
      ) : null}
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Hide' : 'Show'} details for ${skill.name}`} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        {open ? 'Hide details' : 'Show details'}
        
      </Button>
      {open ? (
        <div id={panelId} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Usage instructions</h3>
            <p className="mt-1 text-sm whitespace-pre-wrap break-words">{skill.instructions}</p>
          </div>
          {skill.samplePrompt ? (
            <div>
              <h3 className="text-sm font-semibold">Sample prompt</h3>
              <p className="mt-1 rounded-xl bg-[var(--bg-elevated)] p-3 text-sm whitespace-pre-wrap break-words">{skill.samplePrompt}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => onCopy(skill)} aria-label={`Copy ${skill.name} to clipboard`}>
          <Copy className="h-4 w-4" aria-hidden="true" /> Copy to clipboard
        </Button>
        <Button size="sm" onClick={() => onUse(skill)} aria-label={`Use ${skill.name} in Prompt Studio`}>
          <Send className="h-4 w-4" aria-hidden="true" /> Use in Prompt Studio
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(skill)} aria-label={`Edit ${skill.name}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Delete ${skill.name}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </Button>
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label={`Confirm delete ${skill.name}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--status-danger)] p-3 text-sm">
          <span className="min-w-0 break-words">Delete this skill entry? This cannot be undone.</span>
          <Button variant="danger" size="sm" onClick={() => onDelete(skill)}>Confirm delete</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : null}
    </Card>
  );
}
