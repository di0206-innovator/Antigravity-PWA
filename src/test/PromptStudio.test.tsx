import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { promptsRepo } from '../db/repo';
import { PromptStudioPage } from '../pages/PromptStudioPage';
import { useAppStore } from '../stores/useAppStore';

const renderPage = () =>
  render(
    <MemoryRouter>
      <PromptStudioPage />
    </MemoryRouter>
  );

describe('PromptStudioPage', () => {
  beforeEach(async () => {
    useAppStore.getState().resetEphemeralState();
    await Promise.all([db.prompts.clear(), db.promptDrafts.clear(), db.activityLog.clear(), db.projects.clear()]);
  });

  it('autosaves and restores drafts', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await user.type(await screen.findByLabelText('Prompt'), 'hello draft');
    await waitFor(async () => expect((await promptsRepo.getDraft()).body).toBe('hello draft'), { timeout: 3000 });
    unmount();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Prompt')).toHaveValue('hello draft'));
  });

  it('interpolates variables in preview', async () => {
    const user = userEvent.setup();
    renderPage();
    const editor = await screen.findByLabelText('Prompt');
    await user.click(editor);
    await user.paste('Build {{project_name}} now');
    await user.type(screen.getByLabelText('Project name'), 'Pocket');
    await user.click(screen.getByRole('button', { name: /Preview/ }));
    expect(screen.getByTestId('prompt-preview')).toHaveTextContent('Build Pocket now');
  });

  it('shows copy confirmation and Open Antigravity', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage();
    await user.type(await screen.findByLabelText('Prompt'), 'copy me');
    await user.click(screen.getByRole('button', { name: /Copy prompt/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('copy me'));
    expect(await screen.findByRole('button', { name: /^Copied/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Antigravity/ })).toBeInTheDocument();
    await waitFor(async () =>
      expect((await db.activityLog.toArray()).some((a) => a.description === 'Copied prompt')).toBe(true)
    );
  });

  it('saves a template', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Title'), 'My T');
    await user.click(screen.getByLabelText('Prompt'));
    await user.paste('body {{x}}');
    await user.click(screen.getByRole('button', { name: /Save as template/ }));
    await waitFor(async () => {
      const all = await db.prompts.toArray();
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe('My T');
      expect(all[0].variables).toEqual(['x']);
    });
  });

  it('deletes a template with confirmation', async () => {
    const user = userEvent.setup();
    const t = await promptsRepo.create({ title: 'Doomed', body: 'bye', tags: [] });
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Templates/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete template Doomed' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete Doomed' }));
    await waitFor(async () => expect(await db.prompts.get(t.id)).toBeUndefined());
  });
});
