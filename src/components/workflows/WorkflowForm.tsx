import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { WORKFLOW_CATEGORIES, type WorkflowCategory, type WorkflowEntry } from '../../types/domain';
import { workflowsRepo } from '../../db/repo';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { errorIssues, parseTags } from '../skills/copyText';

export function WorkflowForm({ workflow, onDone }: { workflow?: WorkflowEntry; onDone: () => void }) {
  const addToast = useAppStore((s) => s.addToast);
  const [title, setTitle] = useState(workflow?.title ?? '');
  const [category, setCategory] = useState<WorkflowCategory>(workflow?.category ?? 'Custom');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [steps, setSteps] = useState<string[]>(workflow?.steps.length ? workflow.steps : ['']);
  const [related, setRelated] = useState(workflow?.relatedSkills.join(', ') ?? '');
  const [prompt, setPrompt] = useState(workflow?.copyablePrompt ?? '');
  const [tags, setTags] = useState(workflow?.tags.join(', ') ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    const input = {
      title,
      category,
      description,
      steps: steps.map((s) => s.trim()).filter(Boolean),
      relatedSkills: parseTags(related),
      copyablePrompt: prompt,
      tags: parseTags(tags),
    };
    try {
      if (workflow) await workflowsRepo.update(workflow.id, input);
      else await workflowsRepo.create(input);
      addToast(workflow ? 'Workflow updated.' : 'Workflow created.', 'success');
      onDone();
    } catch (err) {
      setErrors(errorIssues(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {errors.length > 0 ? (
        <div role="alert" className="rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger)]">
          <ul className="list-disc pl-4">
            {errors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
      <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as WorkflowCategory)}>
        {WORKFLOW_CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <fieldset className="space-y-2 min-w-0">
        <legend className="text-sm font-medium">Steps</legend>
        {steps.map((s, i) => (
          <div key={i} className="flex items-end gap-2">
            <Input
              label={`Step ${i + 1}`}
              value={s}
              onChange={(e) => setSteps((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove step ${i + 1}`}
              disabled={steps.length <= 1}
              onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setSteps((p) => [...p, ''])}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add step
        </Button>
      </fieldset>
      <Input label="Related skills" hint="Comma-separated skill names" value={related} onChange={(e) => setRelated(e.target.value)} />
      <Textarea label="Copyable prompt" className="min-h-[140px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <Input label="Tags" hint="Comma-separated" value={tags} onChange={(e) => setTags(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>{workflow ? 'Save changes' : 'Create workflow'}</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
