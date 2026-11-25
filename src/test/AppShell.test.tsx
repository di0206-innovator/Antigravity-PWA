import { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../stores/useAppStore';

const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
let mockNeedRefresh = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => {
    const [needRefresh, setNeedRefresh] = useState(mockNeedRefresh);
    const [offlineReady, setOfflineReady] = useState(false);
    return {
      needRefresh: [needRefresh, setNeedRefresh],
      offlineReady: [offlineReady, setOfflineReady],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

import { AppShell } from '../components/layout/AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    mockUpdateServiceWorker.mockClear();
    useAppStore.getState().resetEphemeralState();
  });

  it('highlights the active primary nav link with aria-current="page" and opens/closes drawer on Escape', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppShell>
          <div>Shell body</div>
        </AppShell>
      </MemoryRouter>
    );

    const settingsLink = screen.getByRole('link', { name: 'Settings' });
    expect(settingsLink).toHaveAttribute('aria-current', 'page');

    const menuButton = screen.getByRole('button', { name: /Open navigation menu/i });
    await user.click(menuButton);
    expect(screen.getByRole('dialog', { name: /Navigation menu/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /Navigation menu/i })).not.toBeInTheDocument();
  });

  it('displays offline banner disclosing Remote Control needs internet when offline', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.queryByText(/Remote Control.*requires an internet connection/i)).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().setOnlineStatus(false);
    });

    expect(
      screen.getByText(/Local AG Pocket modules work offline, while Remote Control/i)
    ).toBeInTheDocument();
  });

  it('shows SW update prompt when needRefresh is true and calls updateServiceWorker(true)', async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </MemoryRouter>
    );

    const reloadBtn = screen.getByRole('button', { name: /Reload to Update/i });
    expect(reloadBtn).toBeInTheDocument();

    await user.click(reloadBtn);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });
});
