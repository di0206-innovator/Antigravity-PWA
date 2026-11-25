import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { TaskBoardPage } from '../pages/TaskBoardPage';
import { useAppStore } from '../stores/useAppStore';

const now = new Date().toISOString();
const base = { description: '', notes: '', createdAt: now, updatedAt: now };

function setup() {
  return render(
    <MemoryRouter>
      <TaskBoardPage />
    </MemoryRouter>
  );
}

describe('TaskBoardPage', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([db.tasks.clear(), db.projects.clear(), db.activityLog.clear()]);
  });

  it('shows disclosure and empty state', async () => {
    setup();
    expect(screen.getByText(/not synced with live Antigravity agent state/i)).toBeInTheDocument();
    await screen.findByText('No tasks yet');
  });

  it('creates, edits, and deletes a task', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('No tasks yet');
    await user.click(screen.getAllByRole('button', { name: /new task/i })[0]);
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await screen.findByRole('alert');
    await user.type(screen.getByLabelText('Title'), 'Write docs');
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await screen.findByText('Write docs');
    expect(await db.tasks.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Edit Write docs' }));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Write more docs');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Write more docs');

    await user.click(screen.getByRole('button', { name: 'Delete Write more docs' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(async () => expect(await db.tasks.count()).toBe(0));
  });

  it('changes status, filters, searches, toggles kanban, flags overdue', async () => {
    const user = userEvent.setup();
    await db.projects.put({
      id: 'p1', title: 'Proj One', category: 'Other', machineName: '', workspaceLabel: '',
      officialUrl: '', description: '', notes: '', pinned: false, createdAt: now, updatedAt: now,
    });
    await db.tasks.bulkPut([
      { ...base, id: 't1', title: 'Alpha task', status: 'Backlog', priority: 'High', projectId: 'p1', dueDate: '2000-01-01' },
      { ...base, id: 't2', title: 'Beta task', status: 'Planned', priority: 'Low' },
    ]);
    setup();
    await screen.findByText('Alpha task');
    expect(screen.getAllByTestId('task-card').find((c) => c.dataset.overdue))?.toHaveTextContent('Alpha task');

    await user.selectOptions(screen.getByLabelText('Status for Alpha task'), 'Completed');
    await waitFor(async () => expect((await db.tasks.get('t1'))?.status).toBe('Completed'));
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Search'), 'beta');
    expect(screen.queryByText('Alpha task')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search'));
    await user.selectOptions(screen.getByLabelText('Priority filter'), 'High');
    expect(screen.queryByText('Beta task')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Priority filter'), '');
    await user.selectOptions(screen.getByLabelText('Project filter'), 'p1');
    expect(screen.queryByText('Beta task')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Project filter'), '');

    await user.click(screen.getByRole('button', { name: /kanban/i }));
    expect(screen.getByTestId('task-kanban')).toBeInTheDocument();
    expect(within(screen.getByTestId('column-Completed')).getByText('Alpha task')).toBeInTheDocument();
    expect(within(screen.getByTestId('column-Planned')).getByText('Beta task')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /list/i }));
    expect(screen.getByTestId('task-list')).toBeInTheDocument();
  });

  it('opens create sheet from quick action', async () => {
    useAppStore.getState().triggerQuickAction('new_task');
    setup();
    await screen.findByRole('dialog', { name: 'New task' });
    expect(useAppStore.getState().quickActionTrigger).toBeNull();
  });
});
