import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { WorkflowLibraryPage } from '../pages/WorkflowLibraryPage';
import { useAppStore } from '../stores/useAppStore';

const t = new Date().toISOString();

function setup() {
  return render(
    <MemoryRouter initialEntries={['/workflows']}>
      <Routes>
        <Route path="/workflows" element={<WorkflowLibraryPage />} />
        <Route path="/prompts" element={<div>Prompts Target</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('WorkflowLibraryPage', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([db.workflows.clear(), db.activityLog.clear()]);
  });

  it('shows empty state', async () => {
    setup();
    expect(await screen.findByText('No workflows yet')).toBeInTheDocument();
  });

  it('creates with steps, edits, copies, uses in studio, and deletes', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    await screen.findByText('No workflows yet');
    await user.click(screen.getByRole('button', { name: /New workflow/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement));
    await user.type(screen.getByLabelText('Title'), 'Ship It');
    await user.type(screen.getByLabelText('Step 1'), 'Build');
    await user.click(screen.getByRole('button', { name: /Add step/ }));
    await user.type(screen.getByLabelText('Step 2'), 'Deploy');
    await user.click(screen.getByRole('button', { name: /Add step/ }));
    await user.click(screen.getByRole('button', { name: 'Remove step 3' }));
    await user.type(screen.getByLabelText('Related skills'), 'Testing');
    await user.type(screen.getByLabelText('Copyable prompt'), 'Please ship');
    await user.click(screen.getByRole('button', { name: 'Create workflow' }));
    await screen.findByRole('heading', { name: 'Ship It' });
    const saved = (await db.workflows.toArray())[0];
    expect(saved.steps).toEqual(['Build', 'Deploy']);

    await user.click(screen.getByRole('button', { name: /Show details/ }));
    expect(screen.getAllByRole('listitem').some((li) => li.textContent === 'Deploy')).toBe(true);
    expect(screen.getByRole('link', { name: 'Testing' })).toHaveAttribute('href', '/skills');

    await user.click(screen.getByRole('button', { name: 'Edit Ship It' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Ship It 2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Ship It 2' });

    await user.click(screen.getByRole('button', { name: 'Copy prompt for Ship It 2' }));
    expect(writeText).toHaveBeenCalledWith('Please ship');
    await waitFor(async () => expect((await db.activityLog.toArray()).some((a) => a.category === 'prompt')).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Use Ship It 2 in Prompt Studio' }));
    expect(useAppStore.getState().pendingPromptInjection).toMatchObject({ source: 'workflow', body: 'Please ship' });
  });

  it('deletes with confirm', async () => {
    const user = userEvent.setup();
    await db.workflows.put({
      id: 'w1', title: 'Gone', description: '', category: 'Custom', steps: ['x'], relatedSkills: [],
      copyablePrompt: '', tags: [], isStarter: false, createdAt: t, updatedAt: t,
    });
    setup();
    await screen.findByText('Gone');
    await user.click(screen.getByRole('button', { name: 'Delete Gone' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.queryByText('Gone')).not.toBeInTheDocument());
  });
});
