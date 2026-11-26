import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  assertZeroForbiddenDomAndStorage,
  assertZeroHorizontalOverflow,
  attachErrorListeners,
  attachSecurityNetworkGuard,
  ensureServiceWorkerReady,
  expectHeading,
  getCopiedTexts,
  getLatestExportedText,
  getThemeSnapshot,
  installClipboardSpy,
  installExportSpy,
  installWindowOpenSpy,
  navigateDrawerRoute,
  navigatePrimaryTab,
  OFFICIAL_URLS,
  openNavDrawer,
  readSettingsRecord,
  resetAppState,
  ROUTES,
  setJsonInputFile,
  triggerAndVerifyOfficialUrl,
  type ErrorCollector,
  type SecurityNetworkGuard,
} from './helpers/app';

let errors: ErrorCollector;
let networkGuard: SecurityNetworkGuard;

async function waitForDialogHidden(page: Page): Promise<void> {
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function createProjectViaUi(
  page: Page,
  options: {
    title: string;
    category?: string;
    machineName?: string;
    workspaceLabel?: string;
    officialUrl?: string;
    description?: string;
    notes?: string;
    pinned?: boolean;
  },
): Promise<void> {
  const newBtn = page
    .getByRole('button', { name: /^new project$/i })
    .or(page.getByRole('button', { name: /create your first project/i }))
    .first();
  await expect(newBtn).toBeVisible();
  await newBtn.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^title$/i).fill(options.title);
  if (options.category) {
    await dialog.getByLabel(/^category$/i).selectOption(options.category);
  }
  if (options.machineName !== undefined) {
    await dialog.getByLabel(/^machine name$/i).fill(options.machineName);
  }
  if (options.workspaceLabel !== undefined) {
    await dialog.getByLabel(/^workspace label$/i).fill(options.workspaceLabel);
  }
  if (options.officialUrl !== undefined) {
    await dialog.getByLabel(/official antigravity session url/i).fill(options.officialUrl);
  }
  if (options.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(options.description);
  }
  if (options.notes !== undefined) {
    await dialog.getByLabel(/^notes$/i).fill(options.notes);
  }
  if (options.pinned) {
    await dialog.getByLabel(/pin this project/i).check();
  }

  await dialog.getByRole('button', { name: /^create project$/i }).click();
  await waitForDialogHidden(page);
  await expect(page.locator('main')).toContainText(options.title);
}

async function createTaskViaUi(
  page: Page,
  options: {
    title: string;
    description?: string;
    projectTitle?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    notes?: string;
  },
): Promise<void> {
  await page.getByRole('button', { name: /^new task$/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^title$/i).fill(options.title);
  if (options.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(options.description);
  }
  if (options.projectTitle) {
    await dialog.getByLabel(/^project$/i).selectOption({ label: options.projectTitle });
  }
  if (options.status) {
    await dialog.getByLabel(/^status$/i).selectOption(options.status);
  }
  if (options.priority) {
    await dialog.getByLabel(/^priority$/i).selectOption(options.priority);
  }
  if (options.dueDate) {
    await dialog.getByLabel(/^due date$/i).fill(options.dueDate);
  }
  if (options.notes !== undefined) {
    await dialog.getByLabel(/^notes$/i).fill(options.notes);
  }

  await dialog.getByRole('button', { name: /^create task$/i }).click();
  await waitForDialogHidden(page);
}

async function selectKanbanTabIfVisible(page: Page, status: string): Promise<void> {
  const tablist = page.getByRole('tablist', { name: /task status/i });
  if (await tablist.isVisible().catch(() => false)) {
    await tablist
      .getByRole('tab', { name: new RegExp(`^${status}\\s*\\(`, 'i') })
      .click();
  }
}

test.describe('Tier 4 — Real-World Application Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    errors = attachErrorListeners(page);
    networkGuard = attachSecurityNetworkGuard(page);
    await installWindowOpenSpy(page);
    await installClipboardSpy(page);
    await installExportSpy(page);
    await resetAppState(page);
  });

  test.afterEach(() => {
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('Scenario 1: Day-1 Mobile Onboarding & Connection Setup Readiness', async ({ page }) => {
    await expectHeading(page, /ag pocket command center/i);
    await expect(page.locator('main')).toContainText('Not configured');

    await page.getByRole('link', { name: /connection setup guide/i }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expectHeading(page, /connection setup center/i);
    await expect(page.locator('main')).toContainText('Not configured');

    const markDoneButtons = page.getByRole('button', { name: /^mark done$/i });
    await expect(markDoneButtons).toHaveCount(4);
    while ((await markDoneButtons.count()) > 0) {
      const before = await markDoneButtons.count();
      await markDoneButtons.first().click();
      await expect(markDoneButtons).toHaveCount(before - 1);
    }

    await expect(page.getByRole('button', { name: /^done$/i })).toHaveCount(4);
    await expect(page.locator('main')).toContainText('Ready to open');

    await page.getByRole('button', { name: 'Copy command /remote-control' }).click();
    await page.getByRole('button', { name: 'Copy command agy remote-control start' }).click();
    await expect.poll(() => getCopiedTexts(page)).toEqual(
      expect.arrayContaining(['/remote-control', 'agy remote-control start']),
    );

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Ready to open');
    await expect(page.locator('main')).not.toContainText('Not configured');

    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /^open antigravity$/i }).first(),
      OFFICIAL_URLS.base,
    );

    await navigateDrawerRoute(page, /activity/i);
    await waitForDialogHidden(page);
    await expect(page).toHaveURL(/\/activity$/);
    await expectHeading(page, /activity log/i);
    await expect(page.locator('main')).toContainText('setup');
    await expect(page.locator('main')).toContainText(/opened official antigravity remote control/i);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Ready to open');

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 2: Multi-Project Architecture Setup & Deep-Link Session Management', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');

    await createProjectViaUi(page, {
      title: 'AG Core API',
      category: 'Backend',
      machineName: 'macbook-pro-m3',
      workspaceLabel: '~/code/ag-core',
      officialUrl: 'https://antigravity.google.com/r/core-123?p=c%2Fabc',
      description: 'Core backend service workspace',
      notes: 'Verify daemon status before opening',
      pinned: true,
    });

    await createProjectViaUi(page, {
      title: 'AG Mobile UI',
      category: 'Web Development',
      machineName: 'linux-dev-01',
      workspaceLabel: '~/code/ag-mobile-ui',
      officialUrl: 'https://antigravity.google.com/r/ui-456',
      description: 'PWA frontend workspace',
      pinned: true,
    });

    await createProjectViaUi(page, {
      title: 'Local Experiment Lab',
      category: 'Experiments',
      machineName: 'sandbox-host',
      workspaceLabel: '~/experiments/lab',
      officialUrl: '',
      pinned: false,
    });

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('AG Core API');
    await expect(page.locator('main')).toContainText('AG Mobile UI');
    await expect(page.locator('main')).not.toContainText('Local Experiment Lab');

    await navigatePrimaryTab(page, 'Projects');
    const searchInput = page.getByLabel(/search projects/i);
    await searchInput.fill('macbook-pro-m3');
    await expect(page.locator('main')).toContainText('AG Core API');
    await expect(page.locator('main')).not.toContainText('AG Mobile UI');

    await searchInput.fill('');
    await page.getByLabel(/^category$/i).selectOption('Web Development');
    await expect(page.locator('main')).toContainText('AG Mobile UI');
    await expect(page.locator('main')).not.toContainText('AG Core API');

    await page.getByLabel(/^category$/i).selectOption('all');
    await page.getByRole('link', { name: 'AG Core API' }).click();
    await expect(page).toHaveURL(/\/projects\/.+$/);
    await expectHeading(page, 'AG Core API');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectHeading(page, 'AG Core API');
    await expect(page.locator('main')).toContainText('macbook-pro-m3');
    await expect(page.locator('main')).toContainText('~/code/ag-core');
    await expect(page.locator('main')).toContainText(
      'https://antigravity.google.com/r/core-123?p=c%2Fabc',
    );

    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /open project in antigravity/i }),
      'https://antigravity.google.com/r/core-123?p=c%2Fabc',
    );

    await page.getByRole('link', { name: /all projects/i }).click();
    await page.getByRole('link', { name: 'Local Experiment Lab' }).click();
    await expectHeading(page, 'Local Experiment Lab');
    await expect(page.locator('main')).toContainText(/no session url saved/i);
    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /^open antigravity$/i }),
      OFFICIAL_URLS.base,
    );

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 3: Skill-Driven Prompt Authoring & Explicit Copy-then-Open Antigravity Flow', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await expect(page.locator('main')).toContainText(/cannot inspect the skills installed/i);

    await page.getByRole('button', { name: 'Show details for Teamwork' }).click();
    await expect(page.locator('main')).toContainText('Usage instructions');
    await expect(page.locator('main')).toContainText('Sample prompt');

    await page.getByRole('button', { name: 'Use Teamwork in Prompt Studio' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expectHeading(page, /prompt studio/i);
    await expect(page.getByLabel(/^prompt$/i)).not.toHaveValue('');

    await page.getByRole('button', { name: /^templates$/i }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Use template Build a New Feature' }).click();
    await waitForDialogHidden(page);

    await page.getByLabel('Project name').fill('AG Pocket Companion');
    await page.getByLabel('Task description').fill('Implement offline-ready prompt preview');
    await page.getByLabel('Tech stack').fill('React 19, TypeScript, Dexie, Playwright');
    await page.getByLabel('Requirements').fill('Zero horizontal overflow at 320px');
    await page.getByLabel('Constraints').fill('Official-first R2 boundary with zero OAuth');
    await page.getByLabel('Skills to use').fill('Teamwork, Hallmark, Testing and QA');

    const previewBtn = page.getByRole('button', { name: /^preview$/i });
    await previewBtn.click();
    await expect(previewBtn).toHaveAttribute('aria-pressed', 'true');

    const preview = page.getByTestId('prompt-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('AG Pocket Companion');
    await expect(preview).toContainText('Teamwork, Hallmark, Testing and QA');
    await expect(page.locator('main')).not.toContainText(/some variables are unfilled/i);

    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await expect.poll(async () => (await getCopiedTexts(page)).length).toBeGreaterThan(0);
    const copied = await getCopiedTexts(page);
    expect(copied[copied.length - 1]).toContain('AG Pocket Companion');
    expect(copied[copied.length - 1]).toContain('Official-first R2 boundary with zero OAuth');

    await expect(page.locator('main')).toContainText('Prompt copied');
    await expect(page.locator('main')).toContainText(/ag pocket never submits prompts/i);

    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /^open antigravity$/i }),
      OFFICIAL_URLS.base,
    );

    await navigateDrawerRoute(page, /activity/i);
    await waitForDialogHidden(page);
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.locator('main')).toContainText('prompt');
    await expect(page.locator('main')).toContainText(/copied prompt/i);

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 4: Release Engineering Workflow to Kanban Task Execution & Home Overview', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Release Train App',
      category: 'Web Development',
      officialUrl: 'https://antigravity.google.com/r/release-train',
      pinned: true,
    });

    await navigateDrawerRoute(page, /workflow library/i);
    await waitForDialogHidden(page);
    await expect(page).toHaveURL(/\/workflows$/);
    await expectHeading(page, /workflow library/i);

    await page.getByLabel(/^category$/i).selectOption('Release Engineering');
    await page
      .getByRole('button', { name: 'Show details for Pre-Release Verification & Vercel Ship' })
      .click();
    await expect(page.locator('main')).toContainText('Steps');
    await expect(page.locator('main')).toContainText('Related skills');

    await page
      .getByRole('button', { name: 'Use Pre-Release Verification & Vercel Ship in Prompt Studio' })
      .click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expect(page.getByLabel(/^prompt$/i)).not.toHaveValue('');

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await expect(page).toHaveURL(/\/tasks$/);
    await expectHeading(page, /task board/i);

    await createTaskViaUi(page, {
      title: 'Run Playwright Verification',
      description: 'Execute Tier 4 scenarios',
      projectTitle: 'Release Train App',
      status: 'Backlog',
      priority: 'High',
      dueDate: '2026-12-20',
    });

    await createTaskViaUi(page, {
      title: 'Verify Vercel Deployment',
      description: 'Check security headers and SPA fallback',
      projectTitle: 'Release Train App',
      status: 'Planned',
      priority: 'Critical',
    });

    await expect(page.getByTestId('task-list')).toBeVisible();
    await page.getByLabel('Status for Run Playwright Verification').selectOption('In Progress');

    await page.getByRole('button', { name: /^kanban$/i }).click();
    await expect(page.getByTestId('task-kanban')).toBeVisible();

    await selectKanbanTabIfVisible(page, 'Planned');
    await expect(page.getByTestId('column-Planned')).toContainText('Verify Vercel Deployment');
    await page.getByLabel('Status for Verify Vercel Deployment').selectOption('Completed');

    await selectKanbanTabIfVisible(page, 'Completed');
    await expect(page.getByTestId('column-Completed')).toContainText('Verify Vercel Deployment');

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Personal Task Overview');
    await expect(page.locator('main')).toContainText('Run Playwright Verification');
    await expect(page.locator('main')).toContainText('In Progress');
    await expect(page.locator('main')).toContainText('Completed');

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 5: Full Backup Export, Two-Step Reset & Validated JSON Restore Migration', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Backup Migration Project',
      category: 'AI / ML',
      machineName: 'studio-mac',
      workspaceLabel: '~/code/migration',
      officialUrl: 'https://antigravity.google.com/r/migration-01',
      pinned: true,
    });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Backup Migration Prompt');
    await page.getByLabel(/^prompt$/i).fill('Verify migration for {{project_name}}.');
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.getByRole('button', { name: /^update template$/i })).toBeVisible();

    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: /^new skill$/i }).click();
    const skillSheet = page.getByRole('dialog');
    await expect(skillSheet).toBeVisible();
    await skillSheet.getByLabel(/^name$/i).fill('Backup Migration Skill');
    await skillSheet.getByLabel(/^category$/i).selectOption('Security');
    await skillSheet.getByLabel(/usage instructions/i).fill('Audit restore validation.');
    await skillSheet.getByRole('button', { name: /^create skill$/i }).click();
    await waitForDialogHidden(page);

    await navigateDrawerRoute(page, /workflow library/i);
    await waitForDialogHidden(page);
    await page.getByRole('button', { name: /^new workflow$/i }).click();
    const wfSheet = page.getByRole('dialog');
    await expect(wfSheet).toBeVisible();
    await wfSheet.getByLabel(/^title$/i).fill('Backup Migration Workflow');
    await wfSheet.getByLabel(/^step 1$/i).fill('Validate exported JSON bundle');
    await wfSheet.getByLabel(/copyable prompt/i).fill('Check backup integrity.');
    await wfSheet.getByRole('button', { name: /^create workflow$/i }).click();
    await waitForDialogHidden(page);

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await createTaskViaUi(page, {
      title: 'Verify Restored Backup Task',
      projectTitle: 'Backup Migration Project',
      status: 'In Progress',
      priority: 'High',
    });

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export local data \(json\)/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(100);
    const exportedJson = await getLatestExportedText(page);
    expect(exportedJson).toContain('Backup Migration Project');
    expect(exportedJson).toContain('Backup Migration Prompt');
    expect(exportedJson).toContain('Backup Migration Skill');
    expect(exportedJson).toContain('Backup Migration Workflow');
    expect(exportedJson).toContain('Verify Restored Backup Task');

    await page.getByRole('button', { name: /clear all local data/i }).click();
    const clearSheet = page.getByRole('dialog');
    await expect(clearSheet).toBeVisible();
    await clearSheet.getByRole('button', { name: /confirm clear all data/i }).click();
    await waitForDialogHidden(page);

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('No projects yet');

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    await expect(page.getByRole('dialog')).toContainText('No templates found');
    await page.keyboard.press('Escape');
    await waitForDialogHidden(page);

    await navigatePrimaryTab(page, 'Skills');
    await expect(page.locator('main')).toContainText('No skills yet');

    await navigateDrawerRoute(page, /workflow library/i);
    await waitForDialogHidden(page);
    await expect(page.locator('main')).toContainText('No workflows yet');

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await expect(page.locator('main')).toContainText('No tasks yet');

    await navigatePrimaryTab(page, 'Settings');
    await setJsonInputFile(
      page.getByLabel('Import local data JSON file'),
      'ag-pocket-backup.json',
      exportedJson,
    );

    const summary = page
      .locator('[role="status"]')
      .filter({ hasText: /import summary/i })
      .first();
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/imported:\s*1 projects/i);
    await expect(summary).toContainText(/1 tasks/i);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Backup Migration Project');

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    await expect(page.getByRole('dialog')).toContainText('Backup Migration Prompt');
    await page.keyboard.press('Escape');
    await waitForDialogHidden(page);

    await navigatePrimaryTab(page, 'Skills');
    await expect(page.locator('main')).toContainText('Backup Migration Skill');

    await navigateDrawerRoute(page, /workflow library/i);
    await waitForDialogHidden(page);
    await expect(page.locator('main')).toContainText('Backup Migration Workflow');

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await expect(page.locator('main')).toContainText('Verify Restored Backup Task');

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 6: Offline Commute Drafting, Reload Persistence & Reconnect Recovery', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    await page.context().setOffline(true);
    await expect(page.locator('header')).toContainText('Offline');
    const offlineBanner = page
      .locator('[role="status"]')
      .filter({ hasText: /remote control.*requires an internet connection/i });
    await expect(offlineBanner).toBeVisible();
    await expect(page.locator('main')).toContainText(/device is offline/i);

    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Offline Commute Project',
      category: 'Mobile Development',
      machineName: 'commute-ipad',
      workspaceLabel: '~/offline-notes',
      officialUrl: 'https://antigravity.google.com/r/commute-1',
      pinned: true,
    });

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await createTaskViaUi(page, {
      title: 'Review Offline Commute Notes',
      projectTitle: 'Offline Commute Project',
      status: 'Planned',
      priority: 'Medium',
    });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Commute Draft Title');
    await page.getByLabel(/^prompt$/i).fill('Drafting offline prompt for {{project_name}}.');

    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            new Promise<string>((resolve) => {
              const req = window.indexedDB.open('ag-pocket-db');
              req.onerror = () => resolve('');
              req.onsuccess = () => {
                const idb = req.result;
                if (!idb.objectStoreNames.contains('promptDrafts')) {
                  idb.close();
                  resolve('');
                  return;
                }
                const getReq = idb
                  .transaction('promptDrafts', 'readonly')
                  .objectStore('promptDrafts')
                  .get('active');
                getReq.onsuccess = () => {
                  idb.close();
                  const rec = getReq.result as { body?: string } | undefined;
                  resolve(rec?.body ?? '');
                };
                getReq.onerror = () => {
                  idb.close();
                  resolve('');
                };
              };
            }),
        ),
      )
      .toContain('Drafting offline prompt');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectHeading(page, /prompt studio/i);
    await expect(offlineBanner).toBeVisible();
    await expect(page.getByLabel(/^title$/i)).toHaveValue('Commute Draft Title');
    await expect(page.getByLabel(/^prompt$/i)).toHaveValue(
      'Drafting offline prompt for {{project_name}}.',
    );

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Offline Commute Project');

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await expect(page.locator('main')).toContainText('Review Offline Commute Notes');

    await page.context().setOffline(false);
    await expect(page.locator('header')).toContainText('Online');
    await expect(offlineBanner).toBeHidden();

    await navigatePrimaryTab(page, 'Home');
    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /^open antigravity$/i }).first(),
      OFFICIAL_URLS.base,
    );

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 7: Adversarial Untrusted Input & R2 Security Boundary Walk', async ({ page }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();
    const projectSheet = page.getByRole('dialog');
    await expect(projectSheet).toBeVisible();
    await projectSheet.getByLabel(/^title$/i).fill('Security Probe Project');

    const badUrls = [
      'javascript:alert(1)',
      'http://antigravity.google.com',
      'https://evil.com',
      'https://antigravity.google.com.evil.com',
      'https://user:pass@antigravity.google.com',
    ];
    for (const badUrl of badUrls) {
      await projectSheet.getByLabel(/official antigravity session url/i).fill(badUrl);
      await projectSheet.getByRole('button', { name: /^create project$/i }).click();
      await expect(projectSheet).toBeVisible();
      await expect(projectSheet).toContainText(/official antigravity|https|invalid url|credentials/i);
    }

    const xssImg = '<img src=x onerror="window.__xssTriggered=true">';
    const xssScript = '<script>window.__xssTriggered=true</script>';
    await projectSheet.getByLabel(/^title$/i).fill(`Safe ${xssImg}`);
    await projectSheet
      .getByLabel(/official antigravity session url/i)
      .fill('https://antigravity.google.com/r/security-walk');
    await projectSheet.getByLabel(/^description$/i).fill(`Desc ${xssScript}`);
    await projectSheet.getByRole('button', { name: /^create project$/i }).click();
    await waitForDialogHidden(page);
    await expect(page.locator('main')).toContainText(xssImg);

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill(`Prompt ${xssImg}`);
    await page.getByLabel(/^prompt$/i).fill(`Audit ${xssScript} with {{project_name}}`);
    await page.getByLabel('Project name').fill('<svg onload="window.__xssTriggered=true">');
    await page.getByRole('button', { name: /^preview$/i }).click();
    await expect(page.getByTestId('prompt-preview')).toContainText(xssScript);

    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: /^new skill$/i }).click();
    const skillSheet = page.getByRole('dialog');
    await skillSheet.getByLabel(/^name$/i).fill(`Skill ${xssImg}`);
    await skillSheet.getByLabel(/usage instructions/i).fill(`Check ${xssScript}`);
    await skillSheet.getByRole('button', { name: /^create skill$/i }).click();
    await waitForDialogHidden(page);

    await navigateDrawerRoute(page, /workflow library/i);
    await waitForDialogHidden(page);
    await page.getByRole('button', { name: /^new workflow$/i }).click();
    const wfSheet = page.getByRole('dialog');
    await wfSheet.getByLabel(/^title$/i).fill(`Workflow ${xssImg}`);
    await wfSheet.getByLabel(/^step 1$/i).fill(`Step ${xssScript}`);
    await wfSheet.getByRole('button', { name: /^create workflow$/i }).click();
    await waitForDialogHidden(page);

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await createTaskViaUi(page, {
      title: `Task ${xssImg}`,
      description: xssScript,
    });

    await navigatePrimaryTab(page, 'Settings');
    await setJsonInputFile(
      page.getByLabel('Import local data JSON file'),
      'malformed.json',
      '{not-valid-json',
    );
    await expect(page.getByRole('alert')).toContainText(/import rejected/i);

    await setJsonInputFile(
      page.getByLabel('Import local data JSON file'),
      'wrong-schema.json',
      JSON.stringify({ schemaVersion: 99, app: 'evil-app', data: {} }),
    );
    await expect(page.getByRole('alert')).toContainText(/import rejected/i);

    const xssTriggered = await page.evaluate(() => Boolean(window.__xssTriggered));
    expect(xssTriggered).toBe(false);
    await expect(page.locator('main img')).toHaveCount(0);

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 8: Cross-Device Responsive Ergonomics & Theme/A11y Customization', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');

    const initialTheme = await getThemeSnapshot(page);
    expect(initialTheme.dataTheme).toBe('dark');
    expect(initialTheme.isDarkBg).toBe(true);

    const lightBtn = page.getByRole('button', { name: /^light$/i });
    await lightBtn.click();
    await expect(lightBtn).toHaveAttribute('aria-pressed', 'true');

    const reducedMotionSwitch = page.getByRole('switch', { name: /reduced motion/i });
    await reducedMotionSwitch.click();
    await expect(reducedMotionSwitch).toHaveAttribute('aria-checked', 'true');

    const hapticsSwitch = page.getByRole('switch', { name: /browser haptics/i });
    const initialHaptics = await hapticsSwitch.getAttribute('aria-checked');
    await hapticsSwitch.click();
    await expect(hapticsSwitch).toHaveAttribute(
      'aria-checked',
      initialHaptics === 'true' ? 'false' : 'true',
    );

    const lightSnap = await getThemeSnapshot(page);
    expect(lightSnap.dataTheme).toBe('light');
    expect(lightSnap.isDarkBg).toBe(false);
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');

    const persistedSettings = await readSettingsRecord(page);
    expect(persistedSettings?.theme).toBe('light');
    expect(persistedSettings?.reducedMotion).toBe(true);

    await openNavDrawer(page);
    const drawer = page.getByRole('dialog', { name: /navigation menu/i });
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    const menuButton: Locator = page.getByRole('button', { name: /open navigation menu/i });
    await menuButton.focus();
    await expect(menuButton).toBeFocused();

    const viewports = [
      { width: 320, height: 680 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1440, height: 900 },
      { width: 1440, height: 760 },
    ];
    for (const vp of viewports) {
      await page.setViewportSize(vp);
      for (const route of [ROUTES.home, ROUTES.prompts, ROUTES.tasks, ROUTES.settings]) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main')).toBeVisible();
        await assertZeroHorizontalOverflow(page);
      }
    }

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 9: Project Detail Context Handoff -> Linked Prompt Template -> Reload Persistence', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Context Handoff Project',
      category: 'AI / ML',
      machineName: 'dev-m3-max',
      workspaceLabel: '~/repos/context-handoff',
      officialUrl: 'https://antigravity.google.com/r/context-handoff',
      description: 'Verify prompt association flow',
      notes: 'Include Dexie index verification',
    });

    await page.getByRole('link', { name: 'Context Handoff Project' }).click();
    await expectHeading(page, 'Context Handoff Project');

    await page.getByRole('button', { name: /send project context to prompt studio/i }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expect(page.getByLabel(/^prompt$/i)).toContainText('Context Handoff Project');

    await page.getByLabel(/^title$/i).fill('Linked Context Template');
    await page
      .getByLabel(/associated project/i)
      .selectOption({ label: 'Context Handoff Project' });
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.getByRole('button', { name: /^update template$/i })).toBeVisible();

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Context Handoff Project' }).click();
    await expect(page.locator('main')).toContainText('Linked Context Template');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('Linked Context Template');

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('Scenario 10: Duplicate Prevention on Backup Re-Import & Activity History Clear Isolation', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await createProjectViaUi(page, {
      title: 'Idempotent Project',
      category: 'Automation',
      officialUrl: 'https://antigravity.google.com/r/idempotent',
    });

    await navigateDrawerRoute(page, /task board/i);
    await waitForDialogHidden(page);
    await createTaskViaUi(page, {
      title: 'Idempotent Task',
      projectTitle: 'Idempotent Project',
      status: 'Planned',
      priority: 'Low',
    });

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export local data \(json\)/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(100);
    const exported = await getLatestExportedText(page);

    await setJsonInputFile(
      page.getByLabel('Import local data JSON file'),
      'duplicate-backup.json',
      exported,
    );

    const summary = page
      .locator('[role="status"]')
      .filter({ hasText: /import summary/i })
      .first();
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/imported:\s*0 projects,\s*0 prompts,\s*0 skills,\s*0 workflows,\s*0 tasks/i);
    await expect(summary).toContainText(/skipped duplicates:\s*1 projects/i);
    await expect(summary).toContainText(/1 tasks/i);

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.getByRole('link', { name: 'Idempotent Project' })).toHaveCount(1);

    await navigateDrawerRoute(page, /activity/i);
    await waitForDialogHidden(page);
    await expect(page.locator('main')).not.toContainText('No activity yet');

    await page.getByRole('button', { name: /clear history/i }).click();
    const clearDialog = page.getByRole('dialog');
    await expect(clearDialog).toBeVisible();
    await clearDialog.getByRole('button', { name: /confirm clear/i }).click();
    await waitForDialogHidden(page);
    await expect(page.locator('main')).toContainText('No activity yet');

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Idempotent Project');

    networkGuard.assertClean();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });
});
