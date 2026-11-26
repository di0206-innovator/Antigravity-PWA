import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SKILL_CATEGORIES, type SkillCategory, type SkillEntry } from '../../types/domain';
import { skillsRepo } from '../../db/repo';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { errorIssues, parseTags } from './copyText';

export function SkillForm({ skill, onDone }: { skill?: SkillEntry; onDone: () => void }) {
  const addToast = useAppStore((s) => s.addToast);
  const [name, setName] = useState(skill?.name ?? '');
  const [category, setCategory] = useState<SkillCategory>(skill?.category ?? 'Custom');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [instructions, setInstructions] = useState(skill?.instructions ?? '');
  const [samplePrompt, setSamplePrompt] = useState(skill?.samplePrompt ?? '');
  const [tags, setTags] = useState(skill?.tags.join(', ') ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    const input = {
      name,
      category,
      description,
      instructions,
      samplePrompt,
      tags: parseTags(tags),
      isFavorite: skill?.isFavorite ?? false,
    };
    try {
      if (skill) await skillsRepo.update(skill.id, input);
      else await skillsRepo.create(input);
      addToast(skill ? 'Skill updated.' : 'Skill created.', 'success');
      if (mountedRef.current) setSaving(false);
      onDone();
    } catch (err) {
      if (!mountedRef.current) return;
      setSaving(false);
      setErrors(errorIssues(err));
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
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={140} />
      <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as SkillCategory)}>
        {SKILL_CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
      <Textarea label="Usage instructions" className="min-h-[140px]" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={30000} />
      <Textarea label="Sample prompt" value={samplePrompt} onChange={(e) => setSamplePrompt(e.target.value)} maxLength={10000} />
      <Input label="Tags" hint="Comma-separated" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>{skill ? 'Save changes' : 'Create skill'}</Button>
        <Button variant="ghost" disabled={saving} onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
