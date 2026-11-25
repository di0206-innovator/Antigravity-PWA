import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { serializeExportBundle } from '../db/backup';
import { SettingsPage } from '../pages/SettingsPage';
import { useAppStore } from '../stores/useAppStore';

describe('SettingsPage', () => {
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
    await useAppStore.getState().initializeApp();
  });

  it('toggles theme, reduced motion, haptics, and renders Android/iOS install guides and disabled adapter', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /^Light$/i }));
    expect(useAppStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    const reducedMotionSwitch = screen.getByRole('switch', { name: /Reduced motion/i });
    await user.click(reducedMotionSwitch);
    expect(useAppStore.getState().reducedMotion).toBe(true);

    const hapticsSwitch = screen.getByRole('switch', { name: /Browser haptics/i });
    await user.click(hapticsSwitch);
    expect(useAppStore.getState().hapticsEnabled).toBe(false);

    expect(screen.getByText(/Android \(Chrome \/ Edge\)/i)).toBeInTheDocument();
    expect(screen.getByText(/iOS \(Safari\)/i)).toBeInTheDocument();
    expect(screen.getByText('official-antigravity-placeholder')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Privacy & Security Policy/i })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('validates invalid JSON import, imports valid JSON backup, and clears all local data via two-step confirmation', async () => {
    const user = userEvent.setup();
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    );

    // Export
    await user.click(screen.getByRole('button', { name: /Export Local Data/i }));
    await waitFor(() => {
      expect(createObjectUrlSpy).toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalled();
    });

    // Invalid import
    const fileInput = screen.getByLabelText(/Import local data JSON file/i) as HTMLInputElement;
    const badFile = new File(['{not-valid-json'], 'bad.json', { type: 'application/json' });
    await user.upload(fileInput, badFile);
    await waitFor(() => {
      expect(screen.getByText(/Import rejected/i)).toBeInTheDocument();
    });

    // Valid import
    const now = new Date().toISOString();
    const validBundle = serializeExportBundle({
      schemaVersion: 1,
      app: 'ag-pocket',
      exportedAt: now,
      data: {
        projects: [
          {
            id: 'imported-proj-1',
            title: 'Imported Project',
            category: 'AI / ML',
            machineName: 'workstation',
            workspaceLabel: 'ml-lab',
            officialUrl: 'https://antigravity.google.com',
            description: 'Imported from backup',
            notes: '',
            pinned: true,
            createdAt: now,
            updatedAt: now,
          },
        ],
        prompts: [],
        skills: [],
        workflows: [],
        tasks: [],
        activityLog: [],
        settings: [],
        promptDrafts: [],
      },
    });
    const goodFile = new File([validBundle], 'backup.json', { type: 'application/json' });
    await user.upload(fileInput, goodFile);

    await waitFor(async () => {
      expect(screen.getByText(/Import summary/i)).toBeInTheDocument();
      const loaded = await db.projects.get('imported-proj-1');
      expect(loaded?.title).toBe('Imported Project');
    });

    // Two-step Clear All Local Data
    await user.click(screen.getByRole('button', { name: /Clear All Local Data/i }));
    const confirmBtn = screen.getByRole('button', { name: /Confirm Clear All Data/i });
    await user.click(confirmBtn);

    await waitFor(async () => {
      expect(await db.projects.count()).toBe(0);
    });

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    anchorClickSpy.mockRestore();
  });
});
