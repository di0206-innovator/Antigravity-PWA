import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, AppRoutes } from '../App';
import { db } from '../db/database';
import { OFFICIAL_ANTIGRAVITY_BASE_URL } from '../services/security';
import { useAppStore } from '../stores/useAppStore';

describe('AG Pocket M2 App & Routing', () => {
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

  it('renders Home Command Center, primary bottom navigation, and launches official Antigravity URL', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /AG Pocket Command Center/i })
    ).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /Primary navigation/i });
    expect(nav).toHaveTextContent('Home');
    expect(nav).toHaveTextContent('Projects');
    expect(nav).toHaveTextContent('Prompts');
    expect(nav).toHaveTextContent('Skills');
    expect(nav).toHaveTextContent('Settings');

    await waitFor(() => {
      expect(useAppStore.getState().dbStatus).toBe('ready');
    });

    const launchButton = screen.getByRole('button', { name: 'OPEN ANTIGRAVITY' });
    await user.click(launchButton);

    expect(openSpy).toHaveBeenCalledWith(
      OFFICIAL_ANTIGRAVITY_BASE_URL,
      '_blank',
      'noopener,noreferrer'
    );
    openSpy.mockRestore();
  });

  it('navigates across secondary routes via drawer and falls back safely on unknown routes', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/unknown-route-check']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /AG Pocket Command Center/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Open navigation menu/i }));
    const drawer = screen.getByRole('dialog', { name: /Navigation menu/i });
    expect(drawer).toHaveTextContent('Workflow Library');
    expect(drawer).toHaveTextContent('Task Board');
    expect(drawer).toHaveTextContent('Activity Log');
    expect(drawer).toHaveTextContent('Connection Setup Center');
    expect(drawer).toHaveTextContent('Privacy & Security');

    await user.click(screen.getByRole('link', { name: /Privacy & Security/i }));
    expect(
      await screen.findByRole('heading', { name: /Privacy & Security Boundary/i })
    ).toBeInTheDocument();
  });
});
