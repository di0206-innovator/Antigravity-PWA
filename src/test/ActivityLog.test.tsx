import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { logActivity } from '../db/activityService';
import { db } from '../db/database';
import { ActivityLogPage } from '../pages/ActivityLogPage';
import { useAppStore } from '../stores/useAppStore';

describe('ActivityLogPage', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([db.activityLog.clear(), db.projects.clear()]);
  });

  it('shows empty state and banner', async () => {
    render(<ActivityLogPage />);
    expect(screen.getByText(/only records actions taken inside AG Pocket/i)).toBeInTheDocument();
    await screen.findByText('No activity yet');
  });

  it('renders entries with project, filters, and clears', async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    await db.projects.put({
      id: 'p1', title: 'Proj One', category: 'Other', machineName: '', workspaceLabel: '',
      officialUrl: '', description: '', notes: '', pinned: false, createdAt: now, updatedAt: now,
    });
    await logActivity({ category: 'task', description: 'Did a task thing', projectId: 'p1' });
    await logActivity({ category: 'prompt', description: 'Did a prompt thing' });
    render(<ActivityLogPage />);
    await screen.findByText('Did a task thing');
    expect(screen.getByText('Proj One')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Category'), 'prompt');
    expect(screen.queryByText('Did a task thing')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Category'), '');

    await user.click(screen.getByRole('button', { name: /clear history/i }));
    await user.click(screen.getByRole('button', { name: 'Confirm clear' }));
    await waitFor(async () => expect(await db.activityLog.count()).toBe(0));
    await screen.findByText('No activity yet');
    expect(useAppStore.getState().toasts.some((t) => /cleared/i.test(t.message))).toBe(true);
  });
});
