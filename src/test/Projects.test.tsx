import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { projectsRepo } from '../db/repo';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { useAppStore } from '../stores/useAppStore';

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
    await Promise.all([db.projects.clear(), db.prompts.clear(), db.skills.clear(), db.tasks.clear(), db.activityLog.clear()]);
    vi.restoreAllMocks();
  });

  it('shows empty state', async () => {
    renderAt('/projects');
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('creates a project and rejects non-official URLs', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    renderAt('/projects');
    await user.click(await screen.findByRole('button', { name: /^New project/i }));
    await new Promise((r) => setTimeout(r, 60)); // let Sheet focus-trap settle
    await user.type(screen.getByLabelText('Title'), 'Alpha');
    await user.type(screen.getByLabelText(/Official Antigravity session URL/i), 'https://evil.example.com/x');
    expect(await screen.findByText(/must point to https:\/\/antigravity\.google\.com/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await db.projects.count()).toBe(0);

    const url = screen.getByLabelText(/Official Antigravity session URL/i);
    await user.clear(url);
    await user.type(url, 'https://antigravity.google.com/session/1');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(async () => expect(await db.projects.count()).toBe(1), { timeout: 4000 });
    expect((await db.projects.toArray())[0].officialUrl).toBe('https://antigravity.google.com/session/1');
    expect(await screen.findByText('Alpha', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('edits, pins and deletes', async () => {
    const user = userEvent.setup();
    await projectsRepo.create({ title: 'Beta', category: 'Backend' });
    renderAt('/projects');
    await user.click(await screen.findByRole('button', { name: 'Edit Beta' }));
    await new Promise((r) => setTimeout(r, 60));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Beta2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Beta2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pin Beta2' }));
    await waitFor(async () => expect((await db.projects.toArray())[0].pinned).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Delete Beta2' }));
    const dlg = screen.getByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Delete project' }));
    await waitFor(async () => expect(await db.projects.count()).toBe(0));
  });

  it('open button uses saved URL; not-found for bad id', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const p = await projectsRepo.create({ title: 'Gamma', category: 'Other', officialUrl: 'https://antigravity.google.com/s/42' });
    renderAt(`/projects/${p.id}`);
    await user.click(await screen.findByRole('button', { name: /OPEN PROJECT IN ANTIGRAVITY/ }));
    expect(spy).toHaveBeenCalledWith('https://antigravity.google.com/s/42', '_blank', 'noopener,noreferrer');
  });

  it('shows not-found and no-URL states', async () => {
    renderAt('/projects/nope');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('shows no-URL empty state on detail', async () => {
    const p = await projectsRepo.create({ title: 'Delta', category: 'Other' });
    renderAt(`/projects/${p.id}`);
    expect(await screen.findByText('No session URL saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Antigravity/ })).toBeInTheDocument();
  });
});
