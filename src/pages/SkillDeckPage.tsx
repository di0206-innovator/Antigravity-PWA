import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Star } from 'lucide-react';
import { db } from '../db/database';
import { skillsRepo } from '../db/repo';
import { useLive } from '../hooks/useLive';
import { useAppStore } from '../stores/useAppStore';
import { SKILL_CATEGORIES, type SkillEntry } from '../types/domain';
import { SkillCard } from '../components/skills/SkillCard';
import { SkillForm } from '../components/skills/SkillForm';
import { copyWithFeedback, errorIssues } from '../components/skills/copyText';
import { Button } from '../components/ui/Button';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Sheet } from '../components/ui/Sheet';

function composeBody(s: SkillEntry): string {
  return s.samplePrompt ? `${s.instructions}\n\n${s.samplePrompt}` : s.instructions;
}

export function SkillDeckPage() {
  const navigate = useNavigate();
  const addToast = useAppStore((s) => s.addToast);
  const queuePromptInjection = useAppStore((s) => s.queuePromptInjection);
  const { data: skills, loading } = useLive(() => db.skills.toArray(), []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<SkillEntry | undefined>();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (skills ?? [])
      .filter((s) => (category === 'all' || s.category === category) && (!favOnly || s.isFavorite))
      .filter(
        (s) =>
          !q ||
          [s.name, s.description, s.instructions, s.samplePrompt, s.category, ...s.tags]
            .join('\n')
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skills, search, category, favOnly]);

  async function guarded(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      addToast(errorIssues(e).join(' '), 'error');
    }
  }

  const openSheet = (s?: SkillEntry) => {
    setEditing(s);
    setSheetOpen(true);
  };
  const total = skills?.length ?? 0;

  return (
    <div className="space-y-4 min-w-0">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Skill Deck</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Local reference catalogue of skill instructions and prompt snippets.
          </p>
        </div>
        <Button onClick={() => openSheet()}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New skill
        </Button>
      </header>

      <DisclosureBanner variant="warning" title="Manually maintained local reference">
        AG Pocket cannot inspect the skills installed on your desktop. This deck is a manually maintained local
        reference and prompt-composition aid. Starter entries are examples, not claims that anything is installed.
      </DisclosureBanner>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Search skills"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, tag, or text"
        />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {SKILL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      <Button variant={favOnly ? 'primary' : 'outline'} aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
        <Star className="h-4 w-4" aria-hidden="true" /> Favourites only
      </Button>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading skills...</p>
      ) : total === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          title="No skills yet"
          description="Add a skill reference to build your local deck."
          action={<Button onClick={() => openSheet()}>Create a skill</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching skills"
          description="Try a different search, category, or turn off the favourites filter."
        />
      ) : (
        <ul className="space-y-3" aria-label="Skills">
          {filtered.map((s) => (
            <li key={s.id} className="min-w-0">
              <SkillCard
                skill={s}
                onToggleFavorite={(x) => guarded(() => skillsRepo.setFavorite(x.id, !x.isFavorite))}
                onEdit={openSheet}
                onDelete={(x) =>
                  guarded(async () => {
                    await skillsRepo.remove(x.id);
                    addToast('Skill deleted.', 'success');
                  })
                }
                onCopy={(x) => void copyWithFeedback(composeBody(x), `skill "${x.name}"`)}
                onUse={(x) => {
                  queuePromptInjection({
                    source: 'skill',
                    mode: 'append',
                    title: x.name,
                    body: composeBody(x),
                    tags: x.tags,
                  });
                  navigate('/prompts');
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit skill' : 'New skill'}
      >
        <SkillForm skill={editing} onDone={() => setSheetOpen(false)} />
      </Sheet>
    </div>
  );
}
