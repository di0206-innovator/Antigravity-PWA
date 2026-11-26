import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { projectsRepo, promptsRepo } from '../db/repo';
import { ensureSeeded, STARTER_PROMPT_TEMPLATES } from '../db/seedData';
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
    await Promise.all([
      db.prompts.clear(),
      db.promptDrafts.clear(),
      db.activityLog.clear(),
      db.projects.clear(),
      db.settings.clear(),
    ]);
    vi.restoreAllMocks();
  });

  it('autosaves and restores drafts including tags', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await user.type(await screen.findByLabelText('Prompt'), 'hello draft');
    await user.type(screen.getByLabelText('Add tag'), 'mobile');
    await user.click(screen.getByRole('button', { name: 'Add tag to prompt' }));

    const removeBtn = screen.getByRole('button', { name: 'Remove tag mobile' });
    expect(removeBtn.className).toContain('min-h-[44px]');
    expect(removeBtn.className).toContain('min-w-[44px]');

    await waitFor(
      async () => {
        const draft = await promptsRepo.getDraft();
        expect(draft.body).toBe('hello draft');
        expect(draft.tags).toEqual(['mobile']);
      },
      { timeout: 3000 }
    );
    unmount();

    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Prompt')).toHaveValue('hello draft'));
    expect(screen.getByText('mobile')).toBeInTheDocument();
  });

  it('interpolates all 6 standard variables + custom variable, warns when unfilled, and updates word/char counts', async () => {
    const user = userEvent.setup();
    renderPage();
    const editor = await screen.findByLabelText('Prompt');
    await user.click(editor);
    await user.paste(
      '{{project_name}} | {{task_description}} | {{tech_stack}} | {{requirements}} | {{constraints}} | {{skills_to_use}} | {{custom_target}}'
    );

    await user.type(screen.getByLabelText('Project name'), 'AG Pocket');
    await user.type(screen.getByLabelText('Task description'), 'Build UI');
    await user.type(screen.getByLabelText('Tech stack'), 'React');
    await user.type(screen.getByLabelText('Requirements'), 'A11y');
    await user.type(screen.getByLabelText('Constraints'), 'Offline');
    await user.type(screen.getByLabelText('Skills to use'), 'Hallmark');

    await user.click(screen.getByRole('button', { name: /Preview/ }));
    const preview = screen.getByTestId('prompt-preview');
    expect(preview).toHaveTextContent(
      'AG Pocket | Build UI | React | A11y | Offline | Hallmark | {{custom_target}}'
    );
    expect(screen.getByText(/Some variables are unfilled/i)).toBeInTheDocument();
    expect(screen.getByText(/\d+ words · \d+ characters/)).toBeInTheDocument();

    // Quick-insert variable chip works
    await user.click(screen.getByRole('button', { name: 'Insert variable project_name' }));
    expect((screen.getByLabelText('Prompt') as HTMLTextAreaElement).value).toContain('{{project_name}}');
  });

  it('shows copy confirmation with Open Antigravity and Open Antigravity to Review using project URL', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const proj = await projectsRepo.create({
      title: 'Pocket',
      category: 'Web Development',
      officialUrl: 'https://antigravity.google.com/r/review-99',
    });

    renderPage();
    await screen.findByLabelText('Prompt');
    await screen.findByRole('option', { name: 'Pocket' });
    await user.selectOptions(screen.getByLabelText(/Associated project/i), proj.id);
    await user.type(screen.getByLabelText('Prompt'), 'copy me');
    await user.click(screen.getByRole('button', { name: /Copy prompt/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('copy me'));
    expect(await screen.findByRole('button', { name: /^Copied/ })).toBeInTheDocument();

    const openBaseBtn = screen.getByRole('button', { name: /^Open Antigravity$/ });
    const openReviewBtn = screen.getByRole('button', { name: /^Open Antigravity to Review$/ });
    expect(openBaseBtn).toBeInTheDocument();
    expect(openReviewBtn).toBeInTheDocument();

    await user.click(openBaseBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://antigravity.google.com',
      '_blank',
      'noopener,noreferrer'
    );

    await user.click(openReviewBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://antigravity.google.com/r/review-99',
      '_blank',
      'noopener,noreferrer'
    );

    await waitFor(async () =>
      expect((await db.activityLog.toArray()).some((a) => a.description === 'Copied prompt')).toBe(
        true
      )
    );
  });

  it('confirms before clearing editor and draft', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Prompt'), 'keep me');
    await user.click(screen.getByRole('button', { name: /^Clear$/ }));
    expect(screen.getByRole('alertdialog', { name: 'Confirm clear' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Prompt')).toHaveValue('keep me');

    await user.click(screen.getByRole('button', { name: /^Clear$/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, clear' }));
    expect(screen.getByLabelText('Prompt')).toHaveValue('');
    await waitFor(async () => expect((await promptsRepo.getDraft()).body).toBe(''));
  });

  it('lists all 12 starter templates, supports search, Use, Append, Edit/Update, Duplicate, Detach, and Delete', async () => {
    const user = userEvent.setup();
    await ensureSeeded(db);
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Templates/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Prompt templates' });
    await waitFor(() =>
      expect(within(dlg).getByText('Build a New Feature')).toBeInTheDocument()
    );
    for (const starter of STARTER_PROMPT_TEMPLATES) {
      expect(within(dlg).getByText(starter.title)).toBeInTheDocument();
    }

    // Search in templates
    await user.type(within(dlg).getByLabelText('Search templates'), 'Security');
    expect(within(dlg).getByText('Perform a Security Review')).toBeInTheDocument();
    expect(within(dlg).queryByText('Build a New Feature')).not.toBeInTheDocument();

    // Duplicate
    await user.click(
      within(dlg).getByRole('button', { name: 'Duplicate template Perform a Security Review' })
    );
    expect(await within(dlg).findByText('Perform a Security Review (copy)')).toBeInTheDocument();

    // Edit/Use and Update template
    await user.click(
      within(dlg).getByRole('button', { name: 'Edit template Perform a Security Review (copy)' })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(/Editing template:/i)).toBeInTheDocument();

    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Security Review');
    await user.click(screen.getByRole('button', { name: /Update template/ }));
    await waitFor(async () =>
      expect((await db.prompts.toArray()).some((t) => t.title === 'Updated Security Review')).toBe(
        true
      )
    );

    // Append template
    await user.click(screen.getByRole('button', { name: /Templates/ }));
    const dlg2 = await screen.findByRole('dialog', { name: 'Prompt templates' });
    await user.click(
      within(dlg2).getByRole('button', { name: 'Append template Review Git Changes' })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((screen.getByLabelText('Prompt') as HTMLTextAreaElement).value).toContain(
      'Change Context:'
    );

    // Detach active template
    await user.click(screen.getByRole('button', { name: 'Detach' }));
    expect(screen.queryByText(/Editing template:/i)).not.toBeInTheDocument();
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

  it('consumes pendingPromptInjection preserving existing draft and persists immediately across unmount', async () => {
    await promptsRepo.saveDraft({
      title: '',
      body: 'Existing draft line',
      tags: ['existing'],
      variableValues: {},
    });
    useAppStore.getState().queuePromptInjection({
      source: 'skill',
      mode: 'append',
      title: 'Skill Title',
      body: 'Injected skill block',
      tags: ['security'],
    });

    const { unmount } = renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText('Prompt')).toHaveValue(
        'Existing draft line\n\nInjected skill block'
      )
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Skill Title');
    expect(screen.getByText('existing')).toBeInTheDocument();
    expect(screen.getByText('security')).toBeInTheDocument();

    await waitFor(async () =>
      expect((await promptsRepo.getDraft()).body).toBe(
        'Existing draft line\n\nInjected skill block'
      )
    );
    unmount();

    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText('Prompt')).toHaveValue(
        'Existing draft line\n\nInjected skill block'
      )
    );
  });

  it('resets editor and draft on new_prompt quick action', async () => {
    await promptsRepo.saveDraft({
      title: 'Old title',
      body: 'Old body',
      tags: ['old'],
      variableValues: { x: '1' },
    });
    useAppStore.getState().triggerQuickAction('new_prompt');
    renderPage();
    await waitFor(() => expect(useAppStore.getState().quickActionTrigger).toBeNull());
    await waitFor(() => expect(screen.getByLabelText('Prompt')).toHaveValue(''));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.queryByText('old')).not.toBeInTheDocument();
  });
});
