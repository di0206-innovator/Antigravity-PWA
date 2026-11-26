import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { projectsRepo, promptsRepo, skillsRepo, tasksRepo, workflowsRepo } from '../db/repo';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { useAppStore } from '../stores/useAppStore';
import { PROJECT_CATEGORIES } from '../types/domain';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/prompts" element={<div>Prompts Target</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Projects', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([
      db.projects.clear(),
      db.prompts.clear(),
      db.promptDrafts.clear(),
      db.skills.clear(),
      db.workflows.clear(),
      db.tasks.clear(),
      db.activityLog.clear(),
    ]);
    vi.restoreAllMocks();
  });

  it('shows empty state', async () => {
    renderAt('/projects');
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('creates a project, strips unsafe control chars, normalizes URL, and rejects non-official URLs', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    renderAt('/projects');
    await user.click(await screen.findByRole('button', { name: /^New project/i }));
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    );

    await user.type(screen.getByLabelText('Title'), 'Alpha');
    fireEvent.change(screen.getByLabelText('Machine name'), { target: { value: 'Mac\u0001-Pro' } });
    fireEvent.change(screen.getByLabelText('Workspace label'), { target: { value: 'ag\u0002-pocket' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Main\u0007 workspace' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Private\u0001 notes' } });
    await user.type(
      screen.getByLabelText(/Official Antigravity session URL/i),
      'https://evil.example.com/x'
    );
    expect(await screen.findByText(/must point to https:\/\/antigravity\.google\.com/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await db.projects.count()).toBe(0);

    const url = screen.getByLabelText(/Official Antigravity session URL/i);
    await user.clear(url);
    await user.type(url, 'https://antigravity.google.com/');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const created = (await db.projects.toArray())[0];
    expect(created.officialUrl).toBe('https://antigravity.google.com');
    expect(created.machineName).toBe('Mac-Pro');
    expect(created.workspaceLabel).toBe('ag-pocket');
    expect(created.description).toBe('Main workspace');
    expect(created.notes).toBe('Private notes');
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(
      (await db.activityLog.toArray()).some((a) => a.description === 'Created project "Alpha"')
    ).toBe(true);
  });

  it('edits, pins/unpins, and deletes while detaching tasks, prompts, and active draft', async () => {
    const user = userEvent.setup();
    const proj = await projectsRepo.create({ title: 'Beta', category: 'Backend' });
    const task = await tasksRepo.create({ title: 'Linked task', projectId: proj.id });
    const prompt = await promptsRepo.create({
      title: 'Linked prompt',
      body: 'Body',
      tags: [],
      projectId: proj.id,
    });
    await promptsRepo.saveDraft({
      title: 'Draft',
      body: 'Hello',
      tags: [],
      variableValues: {},
      selectedProjectId: proj.id,
    });

    renderAt('/projects');
    await user.click(await screen.findByRole('button', { name: 'Edit Beta' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    );
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Beta2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Beta2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pin Beta2' }));
    await waitFor(async () => expect((await db.projects.toArray())[0].pinned).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Unpin Beta2' }));
    await waitFor(async () => expect((await db.projects.toArray())[0].pinned).toBe(false));

    await user.click(screen.getByRole('button', { name: 'Delete Beta2' }));
    const dlg = screen.getByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(async () => expect(await db.projects.count()).toBe(0));

    // Linked records preserved and detached
    expect((await db.tasks.get(task.id))?.projectId).toBeUndefined();
    expect((await db.prompts.get(prompt.id))?.projectId).toBeUndefined();
    expect((await promptsRepo.getDraft()).selectedProjectId).toBeUndefined();
  });

  it('searches across notes, filters all 8 categories, clears filters, and sorts pinned first', async () => {
    const user = userEvent.setup();
    await projectsRepo.create({
      title: 'Unpinned AI',
      category: 'AI / ML',
      notes: 'Special needle phrase',
      pinned: false,
    });
    await projectsRepo.create({
      title: 'Pinned Web',
      category: 'Web Development',
      pinned: true,
    });

    renderAt('/projects');
    await screen.findByText('Pinned Web');

    // Pinned project appears before unpinned
    const links = screen.getAllByRole('link').filter((el) => el.getAttribute('href')?.startsWith('/projects/'));
    expect(links[0]).toHaveTextContent('Pinned Web');
    expect(links[1]).toHaveTextContent('Unpinned AI');

    // All 8 categories exist in the Category filter select
    const categorySelect = screen.getByLabelText('Category');
    for (const c of PROJECT_CATEGORIES) {
      expect(within(categorySelect).getByRole('option', { name: c })).toBeInTheDocument();
    }

    // Filter by category
    await user.selectOptions(categorySelect, 'AI / ML');
    expect(screen.queryByText('Pinned Web')).not.toBeInTheDocument();
    expect(screen.getByText('Unpinned AI')).toBeInTheDocument();

    // Search matches notes
    await user.selectOptions(categorySelect, 'all');
    await user.type(screen.getByLabelText('Search projects'), 'needle');
    expect(screen.queryByText('Pinned Web')).not.toBeInTheDocument();
    expect(screen.getByText('Unpinned AI')).toBeInTheDocument();

    // No matching projects + Clear filters
    await user.clear(screen.getByLabelText('Search projects'));
    await user.type(screen.getByLabelText('Search projects'), 'nonexistent');
    expect(screen.getByText('No matching projects')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Pinned Web')).toBeInTheDocument();
    expect(screen.getByText('Unpinned AI')).toBeInTheDocument();
  });

  it('opens create sheet from new_project quick action', async () => {
    useAppStore.getState().triggerQuickAction('new_project');
    renderAt('/projects');
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument()
    );
    expect(useAppStore.getState().quickActionTrigger).toBeNull();
  });

  it('rejects control-char-only title with inline alert', async () => {
    const user = userEvent.setup();
    renderAt('/projects');
    await user.click(await screen.findByRole('button', { name: /^New project/i }));
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '\u0001\u0002\u0007' } });
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Project title is required.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('open button uses saved URL, logs activity, and renders associated items on ProjectDetailPage', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const p = await projectsRepo.create({
      title: 'Gamma',
      category: 'Other',
      machineName: 'Studio Mac',
      workspaceLabel: 'gamma-ws',
      description: 'Project desc',
      notes: 'Project note',
      officialUrl: 'https://antigravity.google.com/s/42',
    });
    await tasksRepo.create({ title: 'Gamma Task', projectId: p.id, status: 'In Progress' });
    await promptsRepo.create({ title: 'Gamma Prompt', body: 'Check {{project_name}}', tags: [], projectId: p.id });
    await skillsRepo.create({
      name: 'Fav Skill',
      category: 'Testing',
      instructions: 'Test well',
      isFavorite: true,
    });
    await workflowsRepo.create({
      title: 'Release Checklist',
      category: 'Release Engineering',
      steps: ['Typecheck', 'Test'],
      copyablePrompt: 'Run release checklist',
    });

    renderAt(`/projects/${p.id}`);
    expect(await screen.findByText('Studio Mac')).toBeInTheDocument();
    expect(screen.getByText('gamma-ws')).toBeInTheDocument();
    expect(screen.getByText('Project desc')).toBeInTheDocument();
    expect(screen.getByText('Project note')).toBeInTheDocument();
    expect(screen.getByText('Gamma Task')).toBeInTheDocument();
    expect(screen.getByText('Gamma Prompt')).toBeInTheDocument();
    expect(screen.getByText('Fav Skill')).toBeInTheDocument();
    expect(screen.getByText('Release Checklist')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /OPEN PROJECT IN ANTIGRAVITY/ }));
    expect(spy).toHaveBeenCalledWith(
      'https://antigravity.google.com/s/42',
      '_blank',
      'noopener,noreferrer'
    );
    await waitFor(async () =>
      expect(
        (await db.activityLog.toArray()).some((a) =>
          a.description.includes('Opened saved official Antigravity project URL')
        )
      ).toBe(true)
    );

    await user.click(screen.getByRole('button', { name: /Send project context to Prompt Studio/i }));
    expect(useAppStore.getState().pendingPromptInjection).toMatchObject({
      source: 'project',
      mode: 'append',
    });
    expect(screen.getByText('Prompts Target')).toBeInTheDocument();
  });

  it('shows not-found for bad id', async () => {
    renderAt('/projects/nope');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('shows no-URL empty state on detail and opens base Antigravity', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const p = await projectsRepo.create({ title: 'Delta', category: 'Other' });
    renderAt(`/projects/${p.id}`);
    expect(await screen.findByText('No session URL saved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Open Antigravity/ }));
    expect(spy).toHaveBeenCalledWith(
      'https://antigravity.google.com',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
