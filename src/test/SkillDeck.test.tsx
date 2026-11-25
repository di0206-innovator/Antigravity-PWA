import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { SkillDeckPage } from '../pages/SkillDeckPage';
import { useAppStore } from '../stores/useAppStore';

const t = new Date().toISOString();
const mk = (id: string, name: string, category: 'Frontend' | 'Security', extra = {}) => ({
  id, name, category, description: `${name} desc`, instructions: `${name} instr`, samplePrompt: `${name} sample`,
  tags: ['x'], isFavorite: false, isStarter: false, createdAt: t, updatedAt: t, ...extra,
});

function setup() {
  return render(
    <MemoryRouter initialEntries={['/skills']}>
      <Routes>
        <Route path="/skills" element={<SkillDeckPage />} />
        <Route path="/prompts" element={<div>Prompts Target</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SkillDeckPage', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([db.skills.clear(), db.activityLog.clear()]);
    await db.skills.bulkPut([mk('a', 'Alpha Skill', 'Frontend'), mk('b', 'Beta Skill', 'Security')]);
  });

  it('shows disclosure, searches and filters', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText(/cannot inspect the skills installed/i)).toBeInTheDocument();
    await screen.findByText('Alpha Skill');
    await user.type(screen.getByLabelText('Search skills'), 'beta');
    expect(screen.queryByText('Alpha Skill')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search skills'));
    await user.type(screen.getByLabelText('Search skills'), 'zzz');
    expect(screen.getByText('No matching skills')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search skills'));
    await user.selectOptions(screen.getByLabelText('Category'), 'Security');
    expect(screen.queryByText('Alpha Skill')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Skill')).toBeInTheDocument();
  });

  it('creates, edits, favourites, and deletes', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Alpha Skill');
    await user.click(screen.getByRole('button', { name: /New skill/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement));
    await user.click(screen.getByRole('button', { name: 'Create skill' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/required/i);
    await user.type(screen.getByLabelText('Name'), 'Gamma');
    await user.type(screen.getByLabelText('Usage instructions'), 'do gamma');
    await user.type(screen.getByLabelText('Tags'), 'a, b');
    await user.click(screen.getByRole('button', { name: 'Create skill' }));
    await screen.findByRole('heading', { name: 'Gamma' });
    expect((await db.skills.toArray()).find((s) => s.name === 'Gamma')?.tags).toEqual(['a', 'b']);

    await user.click(screen.getByRole('button', { name: 'Edit Gamma' }));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Gamma2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Gamma2' });

    await user.click(screen.getByRole('button', { name: 'Add Alpha Skill to favourites' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Alpha Skill from favourites' })).toHaveAttribute('aria-pressed', 'true')
    );
    await user.click(screen.getByRole('button', { name: 'Favourites only' }));
    expect(screen.queryByText('Beta Skill')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Favourites only' }));

    await user.click(screen.getByRole('button', { name: 'Delete Beta Skill' }));
    const dlg = screen.getByRole('alertdialog');
    await user.click(within(dlg).getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.queryByText('Beta Skill')).not.toBeInTheDocument());
    expect(await db.skills.get('b')).toBeUndefined();
  });

  it('shows details, copies with feedback, and queues injection', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    await screen.findByText('Alpha Skill');
    await user.click(screen.getByRole('button', { name: /Show details for Alpha Skill/ }));
    expect(screen.getAllByText('Alpha Skill instr').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Copy Alpha Skill to clipboard' }));
    expect(writeText).toHaveBeenCalledWith('Alpha Skill instr\n\nAlpha Skill sample');
    await waitFor(() => expect(useAppStore.getState().toasts.some((x) => /Copied/.test(x.message))).toBe(true));
    await waitFor(async () => expect((await db.activityLog.toArray()).some((a) => a.category === 'prompt')).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Use Alpha Skill in Prompt Studio' }));
    expect(useAppStore.getState().pendingPromptInjection).toMatchObject({ source: 'skill', title: 'Alpha Skill' });
    expect(screen.getByText('Prompts Target')).toBeInTheDocument();
  });
});
