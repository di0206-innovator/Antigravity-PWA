import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { SetupCenterPage } from '../pages/SetupCenterPage';
import { OFFICIAL_DOCS_URLS } from '../services/security';
import { useAppStore } from '../stores/useAppStore';

describe('SetupCenterPage', () => {
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

  it('persists wizard steps in Dexie, updates readiness badge, and renders CLI + Remote Agents + official links', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <MemoryRouter initialEntries={['/setup']}>
        <SetupCenterPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /Connection Setup Center/i })
    ).toBeInTheDocument();

    // All 5 CLI reference commands present
    expect(screen.getAllByText('/remote-control').length).toBeGreaterThan(0);
    expect(screen.getAllByText('agy --remote-control').length).toBeGreaterThan(0);
    expect(screen.getAllByText('agy remote-control start').length).toBeGreaterThan(0);
    expect(screen.getAllByText('agy remote-control status').length).toBeGreaterThan(0);
    expect(screen.getAllByText('agy remote-control stop').length).toBeGreaterThan(0);

    // Non-executing CLI disclosure & Remote Agents & OS daemon info
    expect(screen.getByText(/AG Pocket never wraps or executes the Antigravity CLI/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Google AI Pro/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LaunchAgent/i).length).toBeGreaterThan(0);

    // Official links
    const rcDocsLink = screen.getByRole('link', { name: /^Official Remote Control Docs$/i });
    expect(rcDocsLink).toHaveAttribute('href', OFFICIAL_DOCS_URLS.remoteControl);
    expect(rcDocsLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Toggle step 1 & step 2 -> Ready to open
    const markButtons = screen.getAllByRole('button', { name: /Mark done/i });
    await user.click(markButtons[0]);
    await user.click(markButtons[1]);

    await waitFor(async () => {
      const saved = await db.settings.get('default');
      expect(saved?.setupWizard.desktopRemoteControlEnabled).toBe(true);
      expect(saved?.setupWizard.mobileLauncherVerified).toBe(true);
      expect(screen.getByText('Ready to open')).toBeInTheDocument();
    });

    // Copy CLI command
    await user.click(screen.getByRole('button', { name: 'Copy command agy remote-control start' }));
    expect(writeText).toHaveBeenCalledWith('agy remote-control start');
  });

  it('uses high-contrast --text-code token on CLI reference code blocks across dark and light themes', () => {
    const nodeProcess = (
      globalThis as unknown as {
        process?: {
          cwd: () => string;
          getBuiltinModule?: (id: string) => {
            readFileSync: (filePath: string, encoding: string) => string;
          };
        };
      }
    ).process;
    const fsModule = nodeProcess?.getBuiltinModule?.('node:fs');
    const pathModule = (
      nodeProcess as unknown as {
        getBuiltinModule?: (id: string) => { resolve: (...parts: string[]) => string };
      }
    )?.getBuiltinModule?.('node:path');
    expect(fsModule).toBeDefined();
    expect(pathModule).toBeDefined();

    const indexCss = fsModule!.readFileSync(
      pathModule!.resolve(nodeProcess!.cwd(), 'src/index.css'),
      'utf8'
    );
    const darkBlock = indexCss.match(/:root,\s*\[data-theme="dark"\]\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const lightBlock = indexCss.match(/\[data-theme="light"\]\s*\{[\s\S]*?\}/)?.[0] ?? '';

    expect(darkBlock).toContain('--text-code: #f8fafc;');
    expect(lightBlock).toContain('--text-code: #f8fafc;');
    expect(lightBlock).toContain('--accent-primary: #1d4ed8;');
    expect(lightBlock).toContain('--status-warn: #92400e;');

    const { container } = render(
      <MemoryRouter initialEntries={['/setup']}>
        <SetupCenterPage />
      </MemoryRouter>
    );

    const codeBlocks = Array.from(container.querySelectorAll('pre'));
    expect(codeBlocks).toHaveLength(5);
    for (const pre of codeBlocks) {
      expect(pre.className).toContain('bg-[var(--bg-code)]');
      expect(pre.className).toContain('text-[var(--text-code)]');
      expect(pre.className).not.toContain('text-[var(--text-primary)]');
    }
  });
});
