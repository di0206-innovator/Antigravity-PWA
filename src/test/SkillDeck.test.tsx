import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { ensureSeeded, STARTER_SKILLS } from '../db/seedData';
import { PromptStudioPage } from '../pages/PromptStudioPage';
import { SkillDeckPage } from '../pages/SkillDeckPage';
import { useAppStore } from '../stores/useAppStore';
import { SKILL_CATEGORIES } from '../types/domain';

const t = new Date().toISOString();
const mk = (id: string, name: string, category: 'Frontend' | 'Security', extra = {}) => ({
  id,
  name,
  category,
  description: `${name} desc`,
  instructions: `${name} instr`,
  samplePrompt: `${name} sample`,
  tags: ['x'],
  isFavorite: false,
  isStarter: false,
  createdAt: t,
  updatedAt: t,
  ...extra,
});

function setup(withPromptStudio = false) {
  return render(
    <MemoryRouter initialEntries={['/skills']}>
      <Routes>
        <Route path="/skills" element={<SkillDeckPage />} />
        <Route
          path="/prompts"
          element={withPromptStudio ? <PromptStudioPage /> : <div>Prompts Target</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('SkillDeckPage', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([
      db.skills.clear(),
      db.activityLog.clear(),
      db.prompts.clear(),
      db.promptDrafts.clear(),
      db.projects.clear(),
      db.settings.clear(),
    ]);
    await db.skills.bulkPut([mk('a', 'Alpha Skill', 'Frontend'), mk('b', 'Beta Skill', 'Security')]);
    vi.restoreAllMocks();
  });

  it('shows disclosure, searches, filters all 10 categories, and clears filters', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText(/cannot inspect the skills installed/i)).toBeInTheDocument();
    await screen.findByText('Alpha Skill');

    const filterCat = screen.getByLabelText('Category');
    for (const c of SKILL_CATEGORIES) {
      expect(within(filterCat).getByRole('option', { name: c })).toBeInTheDocument();
    }

    await user.type(screen.getByLabelText('Search skills'), 'beta');
    expect(screen.queryByText('Alpha Skill')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search skills'));
    await user.type(screen.getByLabelText('Search skills'), 'zzz');
    expect(screen.getByText('No matching skills')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Alpha Skill')).toBeInTheDocument();
    expect(screen.getByText('Beta Skill')).toBeInTheDocument();

    await user.selectOptions(filterCat, 'Security');
    expect(screen.queryByText('Alpha Skill')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Skill')).toBeInTheDocument();
  });

  it('renders all 9 seeded starter skills and empty state when cleared', async () => {
    await db.skills.clear();
    setup();
    expect(await screen.findByText('No skills yet')).toBeInTheDocument();

    await ensureSeeded(db);
    await waitFor(() => expect(screen.getByText('Hallmark')).toBeInTheDocument());
    for (const starter of STARTER_SKILLS) {
      expect(screen.getByRole('heading', { name: starter.name })).toBeInTheDocument();
    }
  });

  it('creates, edits, favourites, deletes, and sanitizes optional control chars', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Alpha Skill');
    await user.click(screen.getByRole('button', { name: /New skill/ }));
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    );

    const dlg = screen.getByRole('dialog');
    const formCat = within(dlg).getByLabelText('Category');
    for (const c of SKILL_CATEGORIES) {
      expect(within(formCat).getByRole('option', { name: c })).toBeInTheDocument();
    }

    await user.click(within(dlg).getByRole('button', { name: 'Create skill' }));
    expect(await within(dlg).findByRole('alert')).toHaveTextContent(/required/i);

    await user.type(within(dlg).getByLabelText('Name'), 'Gamma');
    fireEvent.change(within(dlg).getByLabelText('Description'), {
      target: { value: 'Clean\u0001 desc' },
    });
    await user.type(within(dlg).getByLabelText('Usage instructions'), 'do gamma');
    fireEvent.change(within(dlg).getByLabelText('Sample prompt'), {
      target: { value: 'Sample\u0007 prompt' },
    });
    await user.type(within(dlg).getByLabelText('Tags'), 'a, b');
    await user.click(within(dlg).getByRole('button', { name: 'Create skill' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByRole('heading', { name: 'Gamma' });

    const created = (await db.skills.toArray()).find((s) => s.name === 'Gamma');
    expect(created?.tags).toEqual(['a', 'b']);
    expect(created?.description).toBe('Clean desc');
    expect(created?.samplePrompt).toBe('Sample prompt');

    await user.click(screen.getByRole('button', { name: 'Edit Gamma' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    );
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Gamma2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByRole('heading', { name: 'Gamma2' });

    await user.click(screen.getByRole('button', { name: 'Add Alpha Skill to favourites' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove Alpha Skill from favourites' })
      ).toHaveAttribute('aria-pressed', 'true')
    );
    await user.click(screen.getByRole('button', { name: 'Favourites only' }));
    expect(screen.queryByText('Beta Skill')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Favourites only' }));

    await user.click(screen.getByRole('button', { name: 'Delete Beta Skill' }));
    const confirmDlg = screen.getByRole('alertdialog');
    await user.click(within(confirmDlg).getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.queryByText('Beta Skill')).not.toBeInTheDocument());
    expect(await db.skills.get('b')).toBeUndefined();
  });

  it('shows details, copies with skill activity feedback, and injects into PromptStudioPage', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup(true);
    await screen.findByText('Alpha Skill');
    await user.click(screen.getByRole('button', { name: /Show details for Alpha Skill/ }));
    expect(screen.getAllByText('Alpha Skill instr').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Copy Alpha Skill to clipboard' }));
    expect(writeText).toHaveBeenCalledWith('Alpha Skill instr\n\nAlpha Skill sample');
    await waitFor(() =>
      expect(useAppStore.getState().toasts.some((x) => /Copied/.test(x.message))).toBe(true)
    );
    await waitFor(async () =>
      expect((await db.activityLog.toArray()).some((a) => a.category === 'skill')).toBe(true)
    );

    await user.click(screen.getByRole('button', { name: 'Use Alpha Skill in Prompt Studio' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Prompt')).toHaveValue('Alpha Skill instr\n\nAlpha Skill sample')
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Alpha Skill');
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
