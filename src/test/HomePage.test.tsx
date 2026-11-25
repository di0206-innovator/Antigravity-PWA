import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultAppSettings, db } from '../db/database';
import { HomePage } from '../pages/HomePage';
import { OFFICIAL_ANTIGRAVITY_BASE_URL } from '../services/security';
import { useAppStore } from '../stores/useAppStore';

describe('HomePage', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([
      db.projects.clear(),
      db.prompts.clear(),
      db.skills.clear(),
      db.workflows.clear(),
      db.tasks.clear(),
      db.activityLog.clear(),
      db.settings.clear(),
      db.promptDrafts.clear(),
    ]);
  });

  it('renders greeting, empty states, disclosure, and all 6 quick actions', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/prompts" element={<div>Prompts Target</div>} />
          <Route path="/projects" element={<div>Projects Target</div>} />
          <Route path="/skills" element={<div>Skills Target</div>} />
          <Route path="/tasks" element={<div>Tasks Target</div>} />
          <Route path="/workflows" element={<div>Workflows Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Good (morning|afternoon|evening)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Settings/i })).toHaveAttribute('href', '/settings');
    expect(screen.getByText(/Remote Access Overview/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Personal local tracker — manually updated, not synced with live Antigravity agent state/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Not configured')).toBeInTheDocument();
      expect(screen.getByText('No pinned projects yet')).toBeInTheDocument();
      expect(screen.getByText('No personal tasks yet')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /New Prompt/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Open Antigravity/i })[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Browse Skills/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Task Note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View Workflow Library/i })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /^Open Antigravity/i })[0]);
    expect(openSpy).toHaveBeenCalledWith(
      OFFICIAL_ANTIGRAVITY_BASE_URL,
      '_blank',
      'noopener,noreferrer'
    );

    await user.click(screen.getByRole('button', { name: /New Prompt/i }));
    expect(useAppStore.getState().quickActionTrigger?.action).toBe('new_prompt');
    expect(screen.getByText('Prompts Target')).toBeInTheDocument();

    openSpy.mockRestore();
  });

  it('displays Ready to open status, pinned projects (JS boolean filter), and active tasks from Dexie', async () => {
    const now = new Date().toISOString();
    const defaults = createDefaultAppSettings(now, 1);
    defaults.setupWizard.desktopRemoteControlEnabled = true;
    defaults.setupWizard.mobileLauncherVerified = true;
    await db.settings.put(defaults);

    await db.projects.bulkPut([
      {
        id: 'proj-pinned',
        title: 'Alpha PWA',
        category: 'Web Development',
        machineName: 'macbook-pro',
        workspaceLabel: 'ag-pocket',
        officialUrl: 'https://antigravity.google.com/r/alpha',
        description: 'Main workspace',
        notes: '',
        pinned: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'proj-unpinned',
        title: 'Hidden Archive',
        category: 'Other',
        machineName: 'linux-box',
        workspaceLabel: 'archive',
        officialUrl: '',
        description: '',
        notes: '',
        pinned: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.tasks.put({
      id: 'task-1',
      title: 'Review release checklist',
      description: '',
      status: 'In Progress',
      priority: 'High',
      notes: '',
      createdAt: now,
      updatedAt: now,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready to open')).toBeInTheDocument();
      expect(screen.getByText('Alpha PWA')).toBeInTheDocument();
      expect(screen.getByText('Review release checklist')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hidden Archive')).not.toBeInTheDocument();
  });
});
