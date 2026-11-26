import { expect, test, type Page } from '@playwright/test';
import {
  attachErrorListeners,
  attachSecurityNetworkGuard,
  createProjectViaUi,
  DEXIE_DB_NAME,
  expectHeading,
  getCopiedTexts,
  installClipboardSpy,
  installWindowOpenSpy,
  navigateDrawerRoute,
  navigatePrimaryTab,
  OFFICIAL_URLS,
  PROJECT_CATEGORIES,
  PROMPT_VARIABLES,
  resetAppState,
  ROUTES,
  STARTER_PROMPT_TITLES,
  triggerAndVerifyOfficialUrl,
  type ErrorCollector,
  type SecurityNetworkGuard,
} from './helpers/app';

let errors: ErrorCollector;
let networkGuard: SecurityNetworkGuard;

interface StoredPromptDraft {
  id?: string;
  title?: string;
  body?: string;
  variableValues?: Record<string, string>;
  selectedTemplateId?: string;
  selectedProjectId?: string;
}

async function readActivePromptDraft(page: Page): Promise<StoredPromptDraft | null> {
  return page.evaluate(
    (dbName) =>
      new Promise<StoredPromptDraft | null>((resolve) => {
        const open = window.indexedDB.open(dbName);
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const idb = open.result;
          if (!idb.objectStoreNames.contains('promptDrafts')) {
            idb.close();
            resolve(null);
            return;
          }
          const req = idb
            .transaction('promptDrafts', 'readonly')
            .objectStore('promptDrafts')
            .get('active');
          req.onsuccess = () => {
            idb.close();
            resolve((req.result as StoredPromptDraft | undefined) ?? null);
          };
          req.onerror = () => {
            idb.close();
            resolve(null);
          };
        };
      }),
    DEXIE_DB_NAME,
  );
}

test.beforeEach(async ({ page }) => {
  errors = attachErrorListeners(page);
  networkGuard = attachSecurityNetworkGuard(page);
  await installWindowOpenSpy(page);
  await installClipboardSpy(page);
  await resetAppState(page);
});

test.afterEach(() => {
  networkGuard.assertClean();
  errors.assertNoErrors();
});

test.describe('F14 — Projects CRUD, Pinning, Search & 8-Category Filter', () => {
  test('F14.1: Projects page renders local-only disclosure and "No projects yet" empty state when empty', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await expectHeading(page, /^projects$/i);

    const main = page.locator('main');
    await expect(main).toContainText(/local workspace organizer/i);
    await expect(main).toContainText(/nothing here reflects live antigravity status/i);
    await expect(main).toContainText('No projects yet');
    await expect(page.getByRole('button', { name: /create your first project/i })).toBeVisible();

    // Filters are hidden while no projects exist.
    await expect(page.getByLabel(/search projects/i)).toHaveCount(0);
    await expect(page.getByLabel(/^category$/i)).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F14.2: creating a project with all fields saves badges, metadata, and pin state', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Pocket Neural Studio',
      category: 'AI / ML',
      machineName: 'macbook-m3-max',
      workspaceLabel: '~/dev/pocket-neural',
      officialUrl: 'https://antigravity.google.com/r/neural-01',
      description: 'On-device embedding playground',
      notes: 'Use WebGPU backend when available.',
      pinned: true,
    });

    const main = page.locator('main');
    await expect(main.getByRole('link', { name: 'Pocket Neural Studio' })).toBeVisible();
    await expect(main).toContainText('AI / ML');
    await expect(main).toContainText('Pinned');
    await expect(main).toContainText('URL saved');
    await expect(main).toContainText('macbook-m3-max · ~/dev/pocket-neural');
    errors.assertNoErrors();
  });

  test('F14.3: editing a project updates title, category, machine, workspace, and session URL', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Draft Service',
      category: 'Other',
      machineName: 'old-box',
      workspaceLabel: 'old-ws',
    });

    await page.getByRole('button', { name: 'Edit Draft Service' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^title$/i).fill('Production API Gateway');
    await dialog.getByLabel(/^category$/i).selectOption('Backend');
    await dialog.getByLabel(/^machine name$/i).fill('linux-prod-01');
    await dialog.getByLabel(/^workspace label$/i).fill('/srv/gateway');
    await dialog
      .getByLabel(/official antigravity session url/i)
      .fill('https://antigravity.google.com/r/gateway-99');
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).toBeHidden();

    const main = page.locator('main');
    await expect(main.getByRole('link', { name: 'Production API Gateway' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Draft Service' })).toHaveCount(0);
    await expect(main).toContainText('Backend');
    await expect(main).toContainText('URL saved');
    await expect(main).toContainText('linux-prod-01 · /srv/gateway');
    errors.assertNoErrors();
  });

  test('F14.4: deleting a project prompts "Delete project?", supports cancel, and removes on confirm', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Disposable Prototype',
      category: 'Experiments',
    });

    // Cancel preserves the project.
    await page.getByRole('button', { name: 'Delete Disposable Prototype' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete project?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('link', { name: 'Disposable Prototype' })).toBeVisible();

    // Confirm removes the project and restores empty state.
    await page.getByRole('button', { name: 'Delete Disposable Prototype' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^delete project$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.locator('main')).toContainText('No projects yet');
    errors.assertNoErrors();
  });

  test('F14.5: pinning and unpinning a project toggles Pinned badge and persists across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Pin Lifecycle App',
      category: 'Web Development',
      pinned: false,
    });

    await expect(page.getByRole('button', { name: 'Pin Pin Lifecycle App' })).toBeVisible();
    await page.getByRole('button', { name: 'Pin Pin Lifecycle App' }).click();
    await expect(page.getByRole('button', { name: 'Unpin Pin Lifecycle App' })).toBeVisible();
    await expect(page.locator('main')).toContainText('Pinned');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Unpin Pin Lifecycle App' })).toBeVisible();

    await page.getByRole('button', { name: 'Unpin Pin Lifecycle App' }).click();
    await expect(page.getByRole('button', { name: 'Pin Pin Lifecycle App' })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Pinned');
    errors.assertNoErrors();
  });

  test('F14.6: searching projects matches title, machine name, and workspace label with clear-filters recovery', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Alpha Frontend',
      category: 'Web Development',
      machineName: 'workstation-north',
      workspaceLabel: 'apps/alpha-ui',
    });
    await createProjectViaUi(page, {
      title: 'Beta Crawler',
      category: 'Automation',
      machineName: 'runner-south',
      workspaceLabel: 'services/beta-bot',
    });

    const searchInput = page.getByLabel(/search projects/i);
    await expect(searchInput).toBeVisible();

    // Match by title
    await searchInput.fill('Alpha');
    await expect(page.getByRole('link', { name: 'Alpha Frontend' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Beta Crawler' })).toHaveCount(0);

    // Match by machine name
    await searchInput.fill('runner-south');
    await expect(page.getByRole('link', { name: 'Beta Crawler' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Alpha Frontend' })).toHaveCount(0);

    // Match by workspace label
    await searchInput.fill('apps/alpha-ui');
    await expect(page.getByRole('link', { name: 'Alpha Frontend' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Beta Crawler' })).toHaveCount(0);

    // No match -> Clear filters restores both
    await searchInput.fill('nonexistent-xyz-999');
    await expect(page.locator('main')).toContainText('No matching projects');
    await page.getByRole('button', { name: /clear filters/i }).click();
    await expect(page.getByRole('link', { name: 'Alpha Frontend' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Beta Crawler' })).toBeVisible();
    errors.assertNoErrors();
  });

  test('F14.7: Category select exposes all 8 categories, filters accurately, and persists projects on reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, { title: 'Mobile Wallet', category: 'Mobile Development' });
    await createProjectViaUi(page, { title: 'Paper Synth', category: 'Research' });

    const categorySelect = page.getByLabel(/^category$/i);
    const options = await categorySelect.locator('option').allTextContents();
    expect(options).toEqual(['All categories', ...PROJECT_CATEGORIES]);

    await categorySelect.selectOption('Mobile Development');
    await expect(page.getByRole('link', { name: 'Mobile Wallet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Paper Synth' })).toHaveCount(0);

    await categorySelect.selectOption('Research');
    await expect(page.getByRole('link', { name: 'Paper Synth' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mobile Wallet' })).toHaveCount(0);

    await categorySelect.selectOption('all');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Mobile Wallet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Paper Synth' })).toBeVisible();
    errors.assertNoErrors();
  });
});

test.describe('F15 — Project Detail (/projects/:id)', () => {
  test('F15.1: Project Detail displays overview, machine, workspace, description, notes, and badges', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Telemetry Core',
      category: 'Backend',
      machineName: 'studio-mac-02',
      workspaceLabel: 'packages/telemetry',
      officialUrl: 'https://antigravity.google.com/r/telemetry',
      description: 'Collects local diagnostics.',
      notes: 'Keep payload compact.',
      pinned: true,
    });

    await page.getByRole('link', { name: 'Telemetry Core' }).click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expectHeading(page, 'Telemetry Core');

    const main = page.locator('main');
    await expect(main).toContainText('Personal records only. Nothing on this page reflects live Antigravity status.');
    await expect(main).toContainText('Backend');
    await expect(main).toContainText('Pinned');
    await expect(main).toContainText('studio-mac-02');
    await expect(main).toContainText('packages/telemetry');
    await expect(main).toContainText('Collects local diagnostics.');
    await expect(main).toContainText('Keep payload compact.');
    errors.assertNoErrors();
  });

  test('F15.2: OPEN PROJECT IN ANTIGRAVITY opens exact saved officialUrl with noopener,noreferrer', async ({
    page,
  }) => {
    const exactUrl = 'https://antigravity.google.com/r/workspace-42?env=prod';
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Launcher Target',
      category: 'Automation',
      officialUrl: exactUrl,
    });

    await page.getByRole('link', { name: 'Launcher Target' }).click();
    await expectHeading(page, 'Launcher Target');
    const detailUrl = page.url();

    const openBtn = page.getByRole('button', { name: /open project in antigravity/i });
    await triggerAndVerifyOfficialUrl(page, openBtn, exactUrl);
    expect(page.url()).toBe(detailUrl);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F15.3: unset URL shows "No session URL saved", "Add URL" allows saving URL, and "Open Antigravity" opens base URL', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Unlinked Workspace',
      category: 'Other',
    });

    await page.getByRole('link', { name: 'Unlinked Workspace' }).click();
    await expectHeading(page, 'Unlinked Workspace');

    await expect(page.locator('main')).toContainText('No session URL saved');
    const openBaseBtn = page.getByRole('button', { name: /^open antigravity$/i });
    await triggerAndVerifyOfficialUrl(page, openBaseBtn, OFFICIAL_URLS.base);

    // Use "Add URL" button to configure the official URL directly from detail view.
    await page.getByRole('button', { name: /^add url$/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit project' });
    await expect(dialog).toBeVisible();
    const newUrl = 'https://antigravity.google.com/r/newly-added';
    await dialog.getByLabel(/official antigravity session url/i).fill(newUrl);
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).toBeHidden();

    const openProjectBtn = page.getByRole('button', { name: /open project in antigravity/i });
    await triggerAndVerifyOfficialUrl(page, openProjectBtn, newUrl);
    errors.assertNoErrors();
  });

  test('F15.4: Project Detail shows linked tasks, associated prompts, and favourite skills', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Linked Hub',
      category: 'Web Development',
    });

    // Favourite a starter skill in Skills
    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Add Hallmark to favourites' }).click();
    await expect(page.getByRole('button', { name: 'Remove Hallmark from favourites' })).toBeVisible();

    // Save a prompt associated with Linked Hub
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Linked Hub Prompt');
    await page.getByLabel(/^prompt$/i).fill('Build linked hub screen.');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Linked Hub' });
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.locator('body')).toContainText('Template saved');

    // Create a task associated with Linked Hub
    await navigateDrawerRoute(page, /task/i);
    await expectHeading(page, /task board/i);
    await page.getByRole('button', { name: /^new task$/i }).first().click();
    const taskDialog = page.getByRole('dialog', { name: 'New task' });
    await taskDialog.getByLabel(/^title$/i).fill('Verify Linked Hub');
    await taskDialog.getByLabel(/^project$/i).selectOption({ label: 'Linked Hub' });
    await taskDialog.getByLabel(/^status$/i).selectOption('In Progress');
    await taskDialog.getByRole('button', { name: /^create task$/i }).click();
    await expect(taskDialog).toBeHidden();

    // Inspect Project Detail linked sections
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Linked Hub' }).click();
    await expectHeading(page, 'Linked Hub');

    const main = page.locator('main');
    await expect(main).toContainText('Verify Linked Hub');
    await expect(main).toContainText('In Progress');
    await expect(main).toContainText('Linked Hub Prompt');
    await expect(main).toContainText('Hallmark');
    await expect(main.getByRole('link', { name: 'Open Workflow Library' })).toBeVisible();
    errors.assertNoErrors();
  });

  test('F15.5: "Send project context to Prompt Studio" injects project context into /prompts editor', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Context Sender App',
      category: 'AI / ML',
      machineName: 'gpu-rig-01',
      workspaceLabel: 'ml/context-sender',
      description: 'Context summary line',
    });

    await page.getByRole('link', { name: 'Context Sender App' }).click();
    await expectHeading(page, 'Context Sender App');
    await page.getByRole('button', { name: /send project context to prompt studio/i }).click();

    await expect(page).toHaveURL(/\/prompts$/);
    await expectHeading(page, /prompt studio/i);
    const editorVal = await page.getByLabel(/^prompt$/i).inputValue();
    expect(editorVal).toContain('Context Sender App');
    expect(editorVal).toContain('gpu-rig-01');
    expect(editorVal).toContain('ml/context-sender');
    errors.assertNoErrors();
  });

  test('F15.6: pin, edit, delete from Project Detail work cleanly and missing :id shows "Project not found"', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Detail Editable',
      category: 'Research',
    });

    await page.getByRole('link', { name: 'Detail Editable' }).click();
    await expectHeading(page, 'Detail Editable');

    // Pin from detail page
    await page.getByRole('button', { name: /^pin$/i }).click();
    await expect(page.getByRole('button', { name: /^unpin$/i })).toBeVisible();
    await expect(page.locator('main')).toContainText('Pinned');

    // Edit from detail page
    await page.getByRole('button', { name: /^edit$/i }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit project' });
    await editDialog.getByLabel(/^title$/i).fill('Detail Renamed');
    await editDialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(editDialog).toBeHidden();
    await expectHeading(page, 'Detail Renamed');

    // Delete from detail page -> returns to /projects
    await page.getByRole('button', { name: /^delete$/i }).click();
    const delDialog = page.getByRole('dialog', { name: 'Delete project?' });
    await delDialog.getByRole('button', { name: /^delete project$/i }).click();
    await expect(delDialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator('main')).toContainText('No projects yet');

    // Missing :id state
    await page.goto(ROUTES.projectDetail('missing-id-404'), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('Project not found');
    await expect(page.getByRole('link', { name: /back to projects/i })).toBeVisible();
    errors.assertNoErrors();
  });
});

test.describe('F16 — Prompt Studio Editor, Autosave, Counts & Copy Flow', () => {
  test('F16.1: multiline editor and title update live word and character counts', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await expectHeading(page, /prompt studio/i);

    const titleInput = page.getByLabel(/^title$/i);
    const bodyInput = page.getByLabel(/^prompt$/i);
    await expect(page.locator('main')).toContainText('0 words · 0 characters');

    await titleInput.fill('Sprint Kickoff');
    const text = 'Alpha beta\ngamma delta';
    await bodyInput.fill(text);

    await expect(page.locator('main')).toContainText(`4 words · ${text.length} characters`);
    errors.assertNoErrors();
  });

  test('F16.2: local draft autosaves into IndexedDB promptDrafts active record and survives reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, { title: 'Draft Linked Repo', category: 'Backend' });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Autosave Spec Title');
    const body = 'Implement {{project_name}} persistence.';
    await page.getByLabel(/^prompt$/i).fill(body);
    await page.getByLabel('Project name').fill('Draft Linked Repo');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Draft Linked Repo' });

    await expect
      .poll(async () => {
        const draft = await readActivePromptDraft(page);
        return {
          title: draft?.title,
          body: draft?.body,
          projVar: draft?.variableValues?.['{{project_name}}'],
          hasProjectId: Boolean(draft?.selectedProjectId),
        };
      })
      .toEqual({
        title: 'Autosave Spec Title',
        body,
        projVar: 'Draft Linked Repo',
        hasProjectId: true,
      });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel(/^title$/i)).toHaveValue('Autosave Spec Title');
    await expect(page.getByLabel(/^prompt$/i)).toHaveValue(body);
    await expect(page.getByLabel('Project name')).toHaveValue('Draft Linked Repo');
    const selectedText = await page
      .getByLabel(/associated project/i)
      .locator('option:checked')
      .textContent();
    expect(selectedText).toBe('Draft Linked Repo');
    errors.assertNoErrors();
  });

  test('F16.3: Clear prompts "Clear the editor and draft?" and "Yes, clear" resets editor and IndexedDB draft', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Temp Title');
    await page.getByLabel(/^prompt$/i).fill('Temporary prompt content');

    await expect
      .poll(async () => (await readActivePromptDraft(page))?.body)
      .toBe('Temporary prompt content');

    await page.getByRole('button', { name: /^clear$/i }).click();
    const confirmBar = page.getByRole('alertdialog', { name: 'Confirm clear' });
    await expect(confirmBar).toBeVisible();
    await expect(confirmBar).toContainText('Clear the editor and draft?');

    // Cancel keeps editor untouched.
    await confirmBar.getByRole('button', { name: /^cancel$/i }).click();
    await expect(confirmBar).toBeHidden();
    await expect(page.getByLabel(/^prompt$/i)).toHaveValue('Temporary prompt content');

    // Yes, clear empties editor and clears draft record.
    await page.getByRole('button', { name: /^clear$/i }).click();
    await confirmBar.getByRole('button', { name: /^yes, clear$/i }).click();

    await expect(page.getByLabel(/^title$/i)).toHaveValue('');
    await expect(page.getByLabel(/^prompt$/i)).toHaveValue('');
    await expect.poll(async () => (await readActivePromptDraft(page))?.body ?? '').toBe('');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel(/^prompt$/i)).toHaveValue('');
    errors.assertNoErrors();
  });

  test('F16.4: Copy prompt copies text, shows "Prompt copied" disclosure without auto-submit claim, and opens Antigravity', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    const promptBody = 'Audit the security boundaries of this repository.';
    await page.getByLabel(/^prompt$/i).fill(promptBody);

    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await expect.poll(async () => (await getCopiedTexts(page)).length).toBeGreaterThan(0);
    const copied = await getCopiedTexts(page);
    expect(copied[copied.length - 1]).toBe(promptBody);

    const main = page.locator('main');
    await expect(main).toContainText('Prompt copied');
    await expect(main).toContainText('AG Pocket never submits prompts. Paste and submit it manually in the official Antigravity interface.');

    const openBtn = main.getByRole('button', { name: /^open antigravity$/i });
    await triggerAndVerifyOfficialUrl(page, openBtn, OFFICIAL_URLS.base);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F16.5: tags can be added via button or Enter, deduplicated, and removed individually', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    const tagInput = page.getByLabel(/^add tag$/i);

    await tagInput.fill('security');
    await page.getByRole('button', { name: 'Add tag to prompt' }).click();
    await expect(page.getByRole('button', { name: 'Remove tag security' })).toBeVisible();

    await tagInput.fill('pwa');
    await tagInput.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove tag pwa' })).toBeVisible();

    // Duplicate tag ignored.
    await tagInput.fill('security');
    await page.getByRole('button', { name: 'Add tag to prompt' }).click();
    await expect(page.getByRole('button', { name: 'Remove tag security' })).toHaveCount(1);

    // Remove one tag.
    await page.getByRole('button', { name: 'Remove tag security' }).click();
    await expect(page.getByRole('button', { name: 'Remove tag security' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove tag pwa' })).toBeVisible();
    errors.assertNoErrors();
  });

  test('F16.6: saving a prompt with an associated project surfaces it on that Project Detail page', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, { title: 'Prompt Owner Project', category: 'Automation' });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Deploy Check Prompt');
    await page.getByLabel(/^prompt$/i).fill('Verify production build checksum.');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Prompt Owner Project' });
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.locator('body')).toContainText('Template saved');

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Prompt Owner Project' }).click();
    await expect(page.locator('main')).toContainText('Deploy Check Prompt');
    errors.assertNoErrors();
  });
});

test.describe('F17 — Prompt Studio Variable Interpolation & Preview', () => {
  test('F17.1: all 6 standard PROMPT_VARIABLES render humanized variable inputs', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^prompt$/i).fill(PROMPT_VARIABLES.join('\n'));

    const expectedLabels = [
      'Project name',
      'Task description',
      'Tech stack',
      'Requirements',
      'Constraints',
      'Skills to use',
    ];
    for (const label of expectedLabels) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    errors.assertNoErrors();
  });

  test('F17.2: custom {{custom_var}} placeholder generates a humanized fill-in field dynamically', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^prompt$/i).fill('Target environment: {{target_region}} and {{release_channel}}.');

    await expect(page.getByLabel('Target region', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Release channel', { exact: true })).toBeVisible();

    await page.getByLabel('Target region', { exact: true }).fill('us-central1');
    await page.getByLabel('Release channel', { exact: true }).fill('canary');
    await page.getByRole('button', { name: /^preview$/i }).click();

    await expect(page.getByTestId('prompt-preview')).toHaveText(
      'Target environment: us-central1 and canary.',
    );
    errors.assertNoErrors();
  });

  test('F17.3: Preview button toggles aria-pressed and shows interpolated prompt-preview output', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    const previewBtn = page.getByRole('button', { name: /^preview$/i });
    await expect(previewBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('prompt-preview')).toHaveCount(0);

    // Empty editor preview shows fallback copy.
    await previewBtn.click();
    await expect(previewBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('prompt-preview')).toHaveText('Nothing to preview yet.');

    await page.getByLabel(/^prompt$/i).fill('Build {{project_name}} with {{tech_stack}}.');
    await page.getByLabel('Project name', { exact: true }).fill('AG Pocket');
    await page.getByLabel('Tech stack', { exact: true }).fill('React + Dexie');
    await expect(page.getByTestId('prompt-preview')).toHaveText(
      'Build AG Pocket with React + Dexie.',
    );

    // Toggle off hides preview.
    await previewBtn.click();
    await expect(previewBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('prompt-preview')).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F17.4: unfilled variable notice renders until all placeholders are filled', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^prompt$/i).fill('Task: {{task_description}}\nLimits: {{constraints}}');
    await page.getByLabel('Task description', { exact: true }).fill('Add offline tests');

    await page.getByRole('button', { name: /^preview$/i }).click();
    const main = page.locator('main');
    await expect(main).toContainText('Some variables are unfilled and will stay as {{placeholders}}.');
    await expect(page.getByTestId('prompt-preview')).toContainText('{{constraints}}');

    await page.getByLabel('Constraints', { exact: true }).fill('Zero external network calls');
    await expect(main).not.toContainText('Some variables are unfilled');
    await expect(page.getByTestId('prompt-preview')).toHaveText(
      'Task: Add offline tests\nLimits: Zero external network calls',
    );
    errors.assertNoErrors();
  });

  test('F17.5: Copy prompt writes the fully interpolated text rather than raw placeholders', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page
      .getByLabel(/^prompt$/i)
      .fill(
        'Project={{project_name}}; Stack={{tech_stack}}; Reqs={{requirements}}; Skills={{skills_to_use}}',
      );
    await page.getByLabel('Project name', { exact: true }).fill('Orbit');
    await page.getByLabel('Tech stack', { exact: true }).fill('TypeScript');
    await page.getByLabel('Requirements', { exact: true }).fill('Offline sync');
    await page.getByLabel('Skills to use', { exact: true }).fill('Testing and QA');

    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await expect.poll(async () => (await getCopiedTexts(page)).length).toBeGreaterThan(0);

    const copied = await getCopiedTexts(page);
    expect(copied[copied.length - 1]).toBe(
      'Project=Orbit; Stack=TypeScript; Reqs=Offline sync; Skills=Testing and QA',
    );
    errors.assertNoErrors();
  });
});

test.describe('F18 — Prompt Studio Template Library & 12 Starters', () => {
  test('F18.1: Templates sheet displays all 12 starter prompt templates on first run', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();

    const sheet = page.getByRole('dialog', { name: /prompt templates/i });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveCount(
      STARTER_PROMPT_TITLES.length,
    );
    for (const title of STARTER_PROMPT_TITLES) {
      await expect(sheet.getByRole('heading', { level: 3, name: title })).toBeVisible();
    }

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    errors.assertNoErrors();
  });

  test('F18.2: searching templates filters by title, tag, or body and shows "No templates found" on miss', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();

    const sheet = page.getByRole('dialog', { name: /prompt templates/i });
    const search = sheet.getByLabel(/search templates/i);

    await search.fill('Security Review');
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveCount(1);
    await expect(sheet.getByRole('heading', { level: 3, name: 'Perform a Security Review' })).toBeVisible();

    await search.fill('totally-unknown-template-xyz');
    await expect(sheet).toContainText('No templates found');

    await search.fill('');
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveCount(
      STARTER_PROMPT_TITLES.length,
    );
    errors.assertNoErrors();
  });

  test('F18.3: Use replaces editor content and Append merges template content into existing draft', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const sheet = page.getByRole('dialog', { name: /prompt templates/i });

    // Use replaces editor with starter template.
    await sheet.getByRole('button', { name: 'Use template Debug an Existing Issue' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByLabel(/^title$/i)).toHaveValue('Debug an Existing Issue');
    const firstBody = await page.getByLabel(/^prompt$/i).inputValue();
    expect(firstBody).toContain('{{task_description}}');

    // Append merges another template below existing content.
    await page.getByRole('button', { name: /^templates$/i }).click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Append template Review Git Changes' }).click();
    await expect(sheet).toBeHidden();

    const mergedBody = await page.getByLabel(/^prompt$/i).inputValue();
    expect(mergedBody.startsWith(firstBody)).toBe(true);
    expect(mergedBody.length).toBeGreaterThan(firstBody.length);
    errors.assertNoErrors();
  });

  test('F18.4: Save as template creates a custom template and Edit + Update template updates it in place', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Custom Release Checklist');
    await page.getByLabel(/^prompt$/i).fill('Run smoke suite for {{project_name}}.');

    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.locator('body')).toContainText('Template saved');

    // Clear editor, then reopen template via Edit action inside Templates sheet.
    await page.getByRole('button', { name: /^clear$/i }).click();
    await page.getByRole('alertdialog', { name: 'Confirm clear' }).getByRole('button', { name: /^yes, clear$/i }).click();

    await page.getByRole('button', { name: /^templates$/i }).click();
    const sheet = page.getByRole('dialog', { name: /prompt templates/i });
    await expect(sheet.getByRole('heading', { level: 3, name: 'Custom Release Checklist' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Edit template Custom Release Checklist' }).click();
    await expect(sheet).toBeHidden();

    // Update template in place.
    await page.getByLabel(/^title$/i).fill('Custom Release Checklist v2');
    await page.getByLabel(/^prompt$/i).fill('Run full E2E suite for {{project_name}}.');
    await page.getByRole('button', { name: /^update template$/i }).click();
    await expect(page.locator('body')).toContainText('Template updated');

    await page.getByRole('button', { name: /^templates$/i }).click();
    await expect(sheet.getByRole('heading', { level: 3, name: 'Custom Release Checklist v2' })).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 3, name: 'Custom Release Checklist', exact: true })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F18.5: Duplicate creates an independent copy of a template in the library', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();

    const sheet = page.getByRole('dialog', { name: /prompt templates/i });
    await sheet.getByRole('button', { name: 'Duplicate template Audit a Codebase' }).click();

    await expect(sheet.getByRole('heading', { level: 3, name: 'Audit a Codebase' })).toBeVisible();
    await expect(
      sheet.getByRole('heading', { level: 3, name: 'Audit a Codebase (copy)' }),
    ).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveCount(
      STARTER_PROMPT_TITLES.length + 1,
    );
    errors.assertNoErrors();
  });

  test('F18.6: deleting a starter template persists across full reload without re-seeding', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();

    const sheet = page.getByRole('dialog', { name: /prompt templates/i });
    await sheet.getByRole('button', { name: 'Delete template Build a New Feature' }).click();
    await sheet.getByRole('button', { name: 'Confirm delete Build a New Feature' }).click();

    await expect(sheet.getByRole('heading', { level: 3, name: 'Build a New Feature' })).toHaveCount(0);
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveCount(
      STARTER_PROMPT_TITLES.length - 1,
    );

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^templates$/i }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 3, name: 'Build a New Feature' })).toHaveCount(0);
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveCount(
      STARTER_PROMPT_TITLES.length - 1,
    );
    errors.assertNoErrors();
  });
});
