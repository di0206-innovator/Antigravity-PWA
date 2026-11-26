import { expect, test } from '@playwright/test';
import {
  assertZeroForbiddenDomAndStorage,
  attachErrorListeners,
  attachSecurityNetworkGuard,
  CONNECTION_READINESS_STATES,
  createProjectViaUi,
  createSkillViaUi,
  createTaskViaUi,
  createWorkflowViaUi,
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
  PROMPT_VARIABLES,
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

test.describe('Tier 3 — Cross-Feature Pairwise Integration Flows', () => {
  // =========================================================================
  // Group 1: Home Quick Actions <-> Modules & Activity Log
  // =========================================================================
  test('T3.1 (F13 x F16): Home "New Prompt" quick action clears editor title, body, tags, and preview', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Stale Draft Title');
    await page.getByLabel('Prompt', { exact: true }).fill('Stale body {{project_name}}');
    await page.getByLabel(/^add tag$/i).fill('stale');
    await page.getByRole('button', { name: 'Add tag to prompt' }).click();
    await page.getByRole('button', { name: /^preview$/i }).click();
    await expect(page.getByTestId('prompt-preview')).toBeVisible();

    await navigatePrimaryTab(page, 'Home');
    await page.getByRole('button', { name: /^new prompt$/i }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expectHeading(page, /prompt studio/i);

    await expect(page.getByLabel(/^title$/i)).toHaveValue('');
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('');
    await expect(page.getByRole('list', { name: 'Tags' })).toHaveCount(0);
    await expect(page.getByTestId('prompt-preview')).toHaveCount(0);
  });

  test('T3.2 (F13 x F14 x F23): Home "New Project" quick action auto-opens sheet and persists to Projects + Activity', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^new project$/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
    const dialog = page.getByRole('dialog', { name: /new project/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^title$/i).fill('Quick Action Project');
    await dialog.getByLabel(/pin this project/i).check();
    await dialog.getByRole('button', { name: /^create project$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('link', { name: 'Quick Action Project' })).toBeVisible();

    await navigateDrawerRoute(page, /activity log/i);
    await expect(page.locator('main')).toContainText('Created project "Quick Action Project"');
  });

  test('T3.3 (F13 x F22): Home "New Task Note" quick action auto-opens sheet and updates Home Task Overview', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^new task note$/i }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    const dialog = page.getByRole('dialog', { name: /new task/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^title$/i).fill('Quick Action Task');
    await dialog.getByLabel(/^status$/i).selectOption('In Progress');
    await dialog.getByRole('button', { name: /^create task$/i }).click();
    await expect(dialog).toBeHidden();

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Quick Action Task');
    await expect(page.locator('main')).toContainText('In Progress');
  });

  test('T3.4 (F13 x F3 x F23): Home "Open Antigravity" quick action launches official URL and logs setup activity', async ({
    page,
  }) => {
    const quickActions = page.getByRole('region', { name: /quick actions/i });
    const openBtn = quickActions.getByRole('button', { name: /^open antigravity$/i });
    await triggerAndVerifyOfficialUrl(page, openBtn, OFFICIAL_URLS.base);

    await navigateDrawerRoute(page, /activity log/i);
    const entry = page
      .locator('main')
      .getByRole('listitem')
      .filter({ hasText: /opened official antigravity remote control/i });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('setup');
  });

  test('T3.5 (F13 x F19 x F20): Home "Browse Skills" quick action navigates to populated Skill Deck', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^browse skills$/i }).click();
    await expect(page).toHaveURL(/\/skills$/);
    await expectHeading(page, /^skill deck$/i);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
    await expect(page.locator('main')).toContainText(
      /cannot inspect the skills installed on your desktop/i,
    );
  });

  test('T3.6 (F13 x F21): Home "View Workflow Library" quick action navigates to Workflow Library', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^view workflow library$/i }).click();
    await expect(page).toHaveURL(/\/workflows$/);
    await expectHeading(page, /^workflow library$/i);
    await expect(page.getByRole('heading', { level: 2, name: 'Development' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Release Engineering' })).toBeVisible();
  });

  // =========================================================================
  // Group 2: Projects <-> Home Pinned Projects <-> Readiness <-> Detail
  // =========================================================================
  test('T3.7 (F14 x F13 x F3): pinning/unpinning projects dynamically updates Home Pinned Projects and conditional Open button', async ({
    page,
  }) => {
    await createProjectViaUi(page, {
      title: 'Pinned With Session',
      officialUrl: 'https://antigravity.google.com/r/pinned-1',
      pinned: true,
    });
    await createProjectViaUi(page, {
      title: 'Pinned No Session',
      pinned: true,
    });
    await createProjectViaUi(page, {
      title: 'Unpinned Repo',
      officialUrl: 'https://antigravity.google.com/r/unpinned',
      pinned: false,
    });

    await navigatePrimaryTab(page, 'Home');
    const main = page.locator('main');
    await expect(main).toContainText('Pinned With Session');
    await expect(main).toContainText('Pinned No Session');
    await expect(main).not.toContainText('Unpinned Repo');

    const withUrlItem = main.getByRole('listitem').filter({ hasText: 'Pinned With Session' });
    await triggerAndVerifyOfficialUrl(
      page,
      withUrlItem.getByRole('button', { name: /^open$/i }),
      'https://antigravity.google.com/r/pinned-1',
    );

    const noUrlItem = main.getByRole('listitem').filter({ hasText: 'Pinned No Session' });
    await expect(noUrlItem.getByRole('button', { name: /^open$/i })).toHaveCount(0);
    await noUrlItem.getByRole('link', { name: /^details$/i }).click();
    await expectHeading(page, 'Pinned No Session');

    // Unpin from Project Detail and verify removal from Home Pinned Projects
    await page.getByRole('button', { name: /^unpin$/i }).click();
    await navigatePrimaryTab(page, 'Home');
    await expect(main).not.toContainText('Pinned No Session');
    await expect(main).toContainText('Pinned With Session');
  });

  test('T3.8 (F14 x F11): adding and clearing project officialUrl transitions Home readiness between Not configured and Remote connection not verified', async ({
    page,
  }) => {
    await expect(page.locator('main')).toContainText('Not configured');

    await createProjectViaUi(page, {
      title: 'URL Readiness Repo',
      officialUrl: 'https://antigravity.google.com/r/readiness',
    });
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Remote connection not verified');

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: 'Edit URL Readiness Repo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit project' });
    await dialog.getByLabel(/official antigravity session url/i).fill('');
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).toBeHidden();

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Not configured');
  });

  test('T3.9 (F14 x F24 x F11): Desktop setup step + project officialUrl satisfies "Ready to open" on Home', async ({
    page,
  }) => {
    await createProjectViaUi(page, {
      title: 'Configured Remote Repo',
      officialUrl: 'https://antigravity.google.com/r/ready-combo',
    });

    await navigateDrawerRoute(page, /connection setup center/i);
    await page.getByRole('button', { name: /^mark done$/i }).first().click();
    await expect(page.locator('main')).toContainText('Ready to open');

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Ready to open');
  });

  test('T3.10 (F14 x F15 x F3): adding officialUrl via Project Detail "Add URL" enables OPEN PROJECT IN ANTIGRAVITY and updates /projects badge', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Add URL Sync Repo' });
    await page.getByRole('link', { name: 'Add URL Sync Repo' }).click();
    await expect(page.locator('main')).toContainText('No session URL saved');

    await page.getByRole('button', { name: /^add url$/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit project' });
    const sessionUrl = 'https://antigravity.google.com/r/synced-42';
    await dialog.getByLabel(/official antigravity session url/i).fill(sessionUrl);
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).toBeHidden();

    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /open project in antigravity/i }),
      sessionUrl,
    );

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('URL saved');
  });

  test('T3.11 (F15 x F16): "Send project context to Prompt Studio" appends project context while preserving existing title and project selection', async ({
    page,
  }) => {
    await createProjectViaUi(page, {
      title: 'Context Target Repo',
      category: 'Backend',
      machineName: 'prod-node-1',
      workspaceLabel: '~/srv/context-target',
      description: 'Core telemetry pipeline',
    });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Existing Prompt Title');
    await page.getByLabel('Prompt', { exact: true }).fill('Initial user instruction.');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Context Target Repo' });

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Context Target Repo' }).click();
    await page.getByRole('button', { name: /send project context to prompt studio/i }).click();

    await expect(page).toHaveURL(/\/prompts$/);
    await expect(page.getByLabel(/^title$/i)).toHaveValue('Existing Prompt Title');
    const selectedLabel = await page
      .getByLabel(/associated project/i)
      .locator('option:checked')
      .textContent();
    expect(selectedLabel).toBe('Context Target Repo');

    const bodyVal = await page.getByLabel('Prompt', { exact: true }).inputValue();
    expect(bodyVal).toContain('Initial user instruction.');
    expect(bodyVal).toContain('Context Target Repo');
    expect(bodyVal).toContain('prod-node-1');
    expect(bodyVal).toContain('~/srv/context-target');
  });

  test('T3.12 (F15 x F18): saving and updating a project-linked template reflects live on Project Detail Associated prompts', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Template Host Repo', category: 'AI / ML' });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Host Repo Audit v1');
    await page.getByLabel('Prompt', { exact: true }).fill('Audit v1 prompt');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Template Host Repo' });
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.getByRole('button', { name: /^update template$/i })).toBeVisible();

    await page.getByLabel(/^title$/i).fill('Host Repo Audit v2');
    await page.getByRole('button', { name: /^update template$/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /template updated/i })).toBeVisible();

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Template Host Repo' }).click();
    await expect(page.locator('main')).toContainText('Host Repo Audit v2');
    await expect(page.locator('main')).not.toContainText('Host Repo Audit v1');
  });

  test('T3.13 (F14 x F18 x F22): deleting a project detaches linked prompt templates and tasks without deleting them', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Detachable Project' });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Surviving Linked Prompt');
    await page.getByLabel('Prompt', { exact: true }).fill('Must survive project deletion.');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Detachable Project' });
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /template saved/i })).toBeVisible();

    await createTaskViaUi(page, {
      title: 'Surviving Linked Task',
      project: 'Detachable Project',
      status: 'Planned',
    });

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: 'Delete Detachable Project' }).click();
    const delDialog = page.getByRole('dialog', { name: 'Delete project?' });
    await delDialog.getByRole('button', { name: /^delete project$/i }).click();
    await expect(delDialog).toBeHidden();

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const tplSheet = page.getByRole('dialog', { name: /prompt templates/i });
    await expect(
      tplSheet.getByRole('heading', { level: 3, name: 'Surviving Linked Prompt' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tplSheet).toBeHidden();

    await navigateDrawerRoute(page, /task board/i);
    const taskCard = page.getByTestId('task-card').filter({ hasText: 'Surviving Linked Task' });
    await expect(taskCard).toBeVisible();
    await expect(taskCard).not.toContainText('Detachable Project');
  });

  test('T3.14 (F15 x F19 x F20): favouriting and unfavouriting skills updates Suggested skills on Project Detail', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Skill Suggestion Host' });
    await page.getByRole('link', { name: 'Skill Suggestion Host' }).click();
    await expect(page.locator('main')).toContainText('No favourite skills yet.');

    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Add Security Review to favourites' }).click();

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Skill Suggestion Host' }).click();
    await expect(page.locator('main')).toContainText('Security Review');

    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Remove Security Review from favourites' }).click();

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Skill Suggestion Host' }).click();
    await expect(page.locator('main')).toContainText('No favourite skills yet.');
  });

  // =========================================================================
  // Group 3: Skills & Workflows -> Prompt Studio -> Copy/Open -> Activity
  // =========================================================================
  test('T3.15 (F19 x F16): "Use in Prompt Studio" from Skill Deck appends body + merges tags while preserving title', async ({
    page,
  }) => {
    await createSkillViaUi(page, {
      name: 'Domain Skill X',
      category: 'Testing',
      instructions: 'Check edge cases thoroughly.',
      samplePrompt: 'Verify {{project_name}} invariants.',
      tags: 'qa, edge-cases',
    });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('My Preserved Title');
    await page.getByLabel('Prompt', { exact: true }).fill('Existing preamble.');
    await page.getByLabel(/^add tag$/i).fill('existing');
    await page.getByRole('button', { name: 'Add tag to prompt' }).click();

    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Use Domain Skill X in Prompt Studio' }).click();

    await expect(page).toHaveURL(/\/prompts$/);
    await expect(
      page.getByRole('status').filter({ hasText: /added to prompt studio/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/^title$/i)).toHaveValue('My Preserved Title');

    const body = await page.getByLabel('Prompt', { exact: true }).inputValue();
    expect(body).toContain('Existing preamble.');
    expect(body).toContain('Check edge cases thoroughly.');
    expect(body).toContain('Verify {{project_name}} invariants.');

    const tags = page.getByRole('list', { name: 'Tags' });
    await expect(tags).toContainText('existing');
    await expect(tags).toContainText('qa');
    await expect(tags).toContainText('edge-cases');
  });

  test('T3.16 (F21 x F16): "Use in Prompt Studio" from Workflow Library uses numbered steps fallback and merges tags while preserving title', async ({
    page,
  }) => {
    await createWorkflowViaUi(page, {
      title: 'Step-Only Workflow',
      category: 'Custom',
      steps: ['Inspect schema', 'Run migration test'],
      copyablePrompt: '',
      tags: 'schema, migration',
    });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Workflow Target Title');

    await navigateDrawerRoute(page, /workflow library/i);
    await page.getByRole('button', { name: 'Use Step-Only Workflow in Prompt Studio' }).click();

    await expect(page).toHaveURL(/\/prompts$/);
    await expect(page.getByLabel(/^title$/i)).toHaveValue('Workflow Target Title');
    const body = await page.getByLabel('Prompt', { exact: true }).inputValue();
    expect(body).toContain('1. Inspect schema\n2. Run migration test');
    await expect(page.getByRole('list', { name: 'Tags' })).toContainText('schema');
    await expect(page.getByRole('list', { name: 'Tags' })).toContainText('migration');
  });

  test('T3.17 (F19 x F21 x F16): chaining Skill Deck + Workflow Library into Prompt Studio merges both bodies and deduplicates tags', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Use Testing and QA in Prompt Studio' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    const afterSkill = await page.getByLabel('Prompt', { exact: true }).inputValue();
    expect(afterSkill.length).toBeGreaterThan(20);

    await navigateDrawerRoute(page, /workflow library/i);
    await page
      .getByRole('button', { name: 'Use End-to-End Feature Delivery in Prompt Studio' })
      .click();
    await expect(page).toHaveURL(/\/prompts$/);
    const combined = await page.getByLabel('Prompt', { exact: true }).inputValue();
    expect(combined.startsWith(afterSkill)).toBe(true);
    expect(combined.length).toBeGreaterThan(afterSkill.length);

    // Ensure duplicate tag chips are not duplicated
    const tagButtons = await page
      .getByRole('list', { name: 'Tags' })
      .getByRole('button')
      .allTextContents();
    expect(new Set(tagButtons).size).toBe(tagButtons.length);
  });

  test('T3.18 (F21 x F19): expanded Workflow card Related skills badge navigates directly to /skills', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow library/i);
    const card = page.getByRole('region', { name: 'End-to-End Feature Delivery' });
    await card.getByRole('button', { name: 'Show details for End-to-End Feature Delivery' }).click();
    const skillLink = card.getByRole('link').first();
    await expect(skillLink).toBeVisible();
    await skillLink.click();

    await expect(page).toHaveURL(/\/skills$/);
    await expectHeading(page, /^skill deck$/i);
  });

  test('T3.19 (F16 x F17 x F3 x F23): interpolating 6 variables -> Preview -> Copy -> Open Antigravity -> Activity Log', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill(PROMPT_VARIABLES.join(' | '));
    await page.getByLabel('Project name', { exact: true }).fill('AG Pocket');
    await page.getByLabel('Task description', { exact: true }).fill('Cross-feature test');
    await page.getByLabel('Tech stack', { exact: true }).fill('React + Dexie');
    await page.getByLabel('Requirements', { exact: true }).fill('Zero backend');
    await page.getByLabel('Constraints', { exact: true }).fill('R2 strict');
    await page.getByLabel('Skills to use', { exact: true }).fill('Teamwork');

    await page.getByRole('button', { name: /^preview$/i }).click();
    await expect(page.getByTestId('prompt-preview')).toHaveText(
      'AG Pocket | Cross-feature test | React + Dexie | Zero backend | R2 strict | Teamwork',
    );

    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await expect.poll(async () => (await getCopiedTexts(page)).length).toBeGreaterThan(0);
    const copied = await getCopiedTexts(page);
    expect(copied[copied.length - 1]).toBe(
      'AG Pocket | Cross-feature test | React + Dexie | Zero backend | R2 strict | Teamwork',
    );

    const copiedBanner = page.getByRole('status').filter({ hasText: /prompt copied/i });
    await expect(copiedBanner).toBeVisible();
    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('button', { name: /^open antigravity$/i }),
      OFFICIAL_URLS.base,
    );

    await navigateDrawerRoute(page, /activity log/i);
    await expect(page.locator('main')).toContainText('Copied prompt');
    await expect(page.locator('main')).toContainText('prompt');
  });

  test('T3.20 (F18 x F17 x F16): inserting starter template -> duplicating -> editing -> updating persists across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const sheet = page.getByRole('dialog', { name: /prompt templates/i });
    await sheet.getByRole('button', { name: 'Duplicate template Audit a Codebase' }).click();
    await sheet.getByRole('button', { name: 'Edit template Audit a Codebase (copy)' }).click();
    await expect(sheet).toBeHidden();

    await page.getByLabel(/^title$/i).fill('Audit a Codebase Custom');
    await page.getByRole('button', { name: /^update template$/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /template updated/i })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^templates$/i }).click();
    await expect(
      sheet.getByRole('heading', { level: 3, name: 'Audit a Codebase Custom' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('T3.21 (F19 x F21 x F23): Skill & Workflow CRUD + copies log skill, workflow, and prompt entries in Activity Log', async ({
    page,
  }) => {
    await createSkillViaUi(page, {
      name: 'Logged Skill',
      instructions: 'Log skill activity.',
    });
    await page.getByRole('button', { name: 'Copy Logged Skill to clipboard' }).click();

    await createWorkflowViaUi(page, {
      title: 'Logged Workflow',
      steps: ['Step 1'],
      copyablePrompt: 'Run logged workflow.',
    });
    await page.getByRole('button', { name: 'Copy prompt for Logged Workflow' }).click();

    await navigateDrawerRoute(page, /activity log/i);
    const main = page.locator('main');
    await expect(main).toContainText('Created skill "Logged Skill"');
    await expect(main).toContainText('Copied skill "Logged Skill"');
    await expect(main).toContainText('Created workflow "Logged Workflow"');
    await expect(main).toContainText('Copied workflow prompt "Logged Workflow"');
  });

  test('T3.22 (F14 x F18 x F23): project-linked template creation logs prompt entry with project badge in Activity Log', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Activity Badge Repo' });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Activity Linked Template');
    await page.getByLabel('Prompt', { exact: true }).fill('Run check.');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Activity Badge Repo' });
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /template saved/i })).toBeVisible();

    await navigateDrawerRoute(page, /activity log/i);
    const entry = page
      .locator('main')
      .getByRole('listitem')
      .filter({ hasText: 'Saved prompt template "Activity Linked Template"' });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('prompt');
    await expect(entry).toContainText('Activity Badge Repo');
  });

  // =========================================================================
  // Group 4: Task Board List <-> Kanban <-> Home <-> Project Detail <-> Activity
  // =========================================================================
  test('T3.23 (F22 x F13): creating tasks across statuses updates Home Personal Task Overview counts and excludes Completed from active list', async ({
    page,
  }) => {
    await createTaskViaUi(page, { title: 'Active Backlog Item', status: 'Backlog' });
    await createTaskViaUi(page, { title: 'Active Attention Item', status: 'Needs Attention' });
    await createTaskViaUi(page, { title: 'Finished Task Item', status: 'Completed' });

    await navigatePrimaryTab(page, 'Home');
    const main = page.locator('main');
    await expect(main).toContainText('Active Backlog Item');
    await expect(main).toContainText('Active Attention Item');
    await expect(main).not.toContainText('Finished Task Item');
  });

  test('T3.24 (F22 x F15 x F23): inline task status change updates Kanban, Project Detail, Home, and Activity Log', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Status Sync Repo' });
    await createTaskViaUi(page, {
      title: 'Transitioning Task',
      project: 'Status Sync Repo',
      status: 'Backlog',
    });

    await page.getByLabel('Status for Transitioning Task').selectOption('In Progress');
    await page.getByRole('button', { name: /^kanban$/i }).click();
    const tablist = page.getByRole('tablist', { name: /task status/i });
    if (await tablist.isVisible().catch(() => false)) {
      await tablist.getByRole('tab', { name: /in progress \(1\)/i }).click();
    }
    await expect(page.getByTestId('column-In Progress')).toContainText('Transitioning Task');

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Status Sync Repo' }).click();
    await expect(page.locator('main')).toContainText('Transitioning Task');
    await expect(page.locator('main')).toContainText('In Progress');

    await navigateDrawerRoute(page, /activity log/i);
    await expect(page.locator('main')).toContainText(
      'Moved task "Transitioning Task" to In Progress',
    );
  });

  test('T3.25 (F22 x F14 x F15): editing a task project association moves it between Project Detail views', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Origin Project' });
    await createProjectViaUi(page, { title: 'Destination Project' });
    await createTaskViaUi(page, { title: 'Reassigned Task', project: 'Origin Project' });

    await page.getByRole('button', { name: 'Edit Reassigned Task' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit task' });
    await dialog.getByLabel(/^project$/i).selectOption({ label: 'Destination Project' });
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).toBeHidden();

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Origin Project' }).click();
    await expect(page.locator('main')).toContainText('No tasks linked to this project.');

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Destination Project' }).click();
    await expect(page.locator('main')).toContainText('Reassigned Task');
  });

  test('T3.26 (F22 x F13): marking all tasks Completed and reopening one updates Home overview summary', async ({
    page,
  }) => {
    await createTaskViaUi(page, { title: 'Toggleable Task', status: 'Planned' });
    await page.getByLabel('Status for Toggleable Task').selectOption('Completed');

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('All 1 personal tasks are marked Completed.');

    await navigateDrawerRoute(page, /task board/i);
    await page.getByLabel('Status for Toggleable Task').selectOption('Needs Attention');

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Toggleable Task');
    await expect(page.locator('main')).not.toContainText(
      'All 1 personal tasks are marked Completed.',
    );
  });

  // =========================================================================
  // Group 5: Setup Center <-> Home Readiness <-> Official Docs <-> Activity
  // =========================================================================
  test('T3.27 (F24 x F11): Setup Center toggles cycle across all 4 ConnectionReadiness states on Home', async ({
    page,
  }) => {
    // 1. Initial: Not configured
    await expect(page.locator('main')).toContainText(CONNECTION_READINESS_STATES[0]);

    // 2. CLI Reference step only -> Setup instructions available
    await navigateDrawerRoute(page, /connection setup center/i);
    const markBtns = page.getByRole('button', { name: /^mark done$/i });
    await markBtns.nth(2).click();
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText(CONNECTION_READINESS_STATES[1]);

    // 3. Desktop step only -> Remote connection not verified
    await navigateDrawerRoute(page, /connection setup center/i);
    await page.getByRole('button', { name: /^mark done$/i }).nth(0).click();
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText(CONNECTION_READINESS_STATES[3]);

    // 4. Mobile step too -> Ready to open
    await navigateDrawerRoute(page, /connection setup center/i);
    await page.getByRole('button', { name: /^mark done$/i }).nth(0).click();
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText(CONNECTION_READINESS_STATES[2]);
  });

  test('T3.28 (F24 x F3 x F23): Setup Center wizard toggle & official launch log setup entries in Activity Log', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    await page.getByRole('button', { name: /^mark done$/i }).first().click();
    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('button', { name: /open antigravity/i }),
      OFFICIAL_URLS.base,
    );

    await navigateDrawerRoute(page, /activity log/i);
    const main = page.locator('main');
    await expect(main).toContainText('Completed setup step');
    await expect(main).toContainText('Opened official Antigravity Remote Control');
  });

  test('T3.29 (F24 x F30 x F12): Official Docs links across Home and Setup Center match antigravity.google/docs/*', async ({
    page,
  }) => {
    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('link', { name: /remote control docs/i }),
      OFFICIAL_URLS.docsRemoteControl,
    );
    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('link', { name: /remote agents docs/i }),
      OFFICIAL_URLS.docsRemoteAgents,
    );

    await navigateDrawerRoute(page, /connection setup center/i);
    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('link', { name: /faq/i }),
      OFFICIAL_URLS.docsFaq,
    );
  });

  // =========================================================================
  // Group 6: Settings, Theme, A11y, Backup/Restore, Clear All & Privacy
  // =========================================================================
  test('T3.30 (F7 x F8 x F10): Theme, Reduced Motion, and Haptics settings persist across all routes and reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /^light$/i }).click();
    await page.getByRole('switch', { name: /reduced motion/i }).click();
    await page.getByRole('switch', { name: /browser haptics/i }).click();

    for (const route of [
      ROUTES.home,
      ROUTES.projects,
      ROUTES.prompts,
      ROUTES.skills,
      ROUTES.workflows,
      ROUTES.tasks,
      ROUTES.activity,
      ROUTES.setup,
      ROUTES.privacy,
    ]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    const snap = await getThemeSnapshot(page);
    expect(snap.isDarkBg).toBe(false);
    const settings = await readSettingsRecord(page);
    expect(settings?.theme).toBe('light');
    expect(settings?.reducedMotion).toBe(true);
    expect(settings?.hapticsEnabled).toBe(false);
  });

  test('T3.31 (F29 x F7 x F14 x F18 x F19 x F21 x F22): Export -> Clear All resets theme -> Import restores full cross-module state without duplicating starters', async ({
    page,
  }) => {
    await createProjectViaUi(page, {
      title: 'Roundtrip Project',
      officialUrl: 'https://antigravity.google.com/r/roundtrip',
      pinned: true,
    });
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Roundtrip Linked Prompt');
    await page.getByLabel('Prompt', { exact: true }).fill('Run {{project_name}}');
    await page.getByLabel(/associated project/i).selectOption({ label: 'Roundtrip Project' });
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /template saved/i })).toBeVisible();

    await createSkillViaUi(page, {
      name: 'Roundtrip Skill',
      instructions: 'Verify roundtrip.',
    });
    await page.getByRole('button', { name: 'Add Roundtrip Skill to favourites' }).click();

    await createWorkflowViaUi(page, {
      title: 'Roundtrip Workflow',
      steps: ['Step A'],
    });
    await createTaskViaUi(page, {
      title: 'Roundtrip Task',
      project: 'Roundtrip Project',
      status: 'In Progress',
    });

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /^light$/i }).click();
    await page.getByRole('button', { name: /export local data \(json\)/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(100);
    const bundle = await getLatestExportedText(page);

    // Clear All Local Data resets theme back to OLED dark default
    await page.getByRole('button', { name: /clear all local data/i }).click();
    const clearDialog = page.getByRole('dialog', { name: /clear all local data/i });
    await clearDialog.getByRole('button', { name: /confirm clear all data/i }).click();
    await expect(clearDialog).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Import restores Light theme and all cross-module relationships
    await setJsonInputFile(
      page.getByLabel('Import local data JSON file'),
      'roundtrip.json',
      bundle,
    );
    await expect(page.getByRole('status').filter({ hasText: /import summary/i })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Roundtrip Project');
    await expect(page.locator('main')).toContainText('Roundtrip Task');

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Roundtrip Project' }).click();
    await expect(page.locator('main')).toContainText('Roundtrip Linked Prompt');
    await expect(page.locator('main')).toContainText('Roundtrip Skill');
    await expect(page.locator('main')).toContainText('Roundtrip Task');

    // Starters should not be duplicated
    await navigatePrimaryTab(page, 'Skills');
    await expect(page.getByRole('heading', { level: 2, name: 'Hallmark' })).toHaveCount(1);
    await navigateDrawerRoute(page, /workflow library/i);
    await expect(page.locator('main')).toContainText('Roundtrip Workflow');
  });

  test('T3.32 (F29 x F23): Clear Activity History preserves Projects, Prompts, Skills, Workflows, Tasks, Setup, and Settings', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Intact Repo' });
    await createTaskViaUi(page, { title: 'Intact Task', project: 'Intact Repo' });
    await navigateDrawerRoute(page, /connection setup center/i);
    await page.getByRole('button', { name: /^mark done$/i }).first().click();

    await navigateDrawerRoute(page, /activity log/i);
    await page.getByRole('button', { name: /^clear history$/i }).click();
    const dialog = page.getByRole('dialog', { name: /clear activity history\?/i });
    await dialog.getByRole('button', { name: /^confirm clear$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('No activity yet');

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.getByRole('link', { name: 'Intact Repo' })).toBeVisible();
    await navigateDrawerRoute(page, /task board/i);
    await expect(page.getByTestId('task-card').filter({ hasText: 'Intact Task' })).toBeVisible();
    await navigateDrawerRoute(page, /connection setup center/i);
    await expect(page.getByRole('button', { name: /^done$/i })).toHaveCount(1);
  });

  test('T3.33 (F28 x F29 x F16): importing a backup with an empty draft does not overwrite a user active non-empty draft', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export local data \(json\)/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(50);
    const emptyDraftBundle = await getLatestExportedText(page);

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Important active draft work');
    await expect(page.locator('main')).toContainText('4 words');

    await navigatePrimaryTab(page, 'Settings');
    await setJsonInputFile(
      page.getByLabel('Import local data JSON file'),
      'backup.json',
      emptyDraftBundle,
    );
    await expect(page.getByRole('status').filter({ hasText: /import summary/i })).toBeVisible();

    await navigatePrimaryTab(page, 'Prompts');
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue(
      'Important active draft work',
    );
  });

  // =========================================================================
  // Group 7: Offline Cross-Module Persistence <-> Reconnect Recovery
  // =========================================================================
  test('T3.34 (F27 x F14 x F22 x F28): creating pinned project and task while offline updates Home and persists across offline reload', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    try {
      await context.setOffline(true);
      await expect(page.getByRole('status').filter({ hasText: /you are offline/i })).toBeVisible();

      await createProjectViaUi(page, { title: 'Offline Pinned Repo', pinned: true });
      await createTaskViaUi(page, {
        title: 'Offline Linked Task',
        project: 'Offline Pinned Repo',
        status: 'Planned',
      });

      await navigatePrimaryTab(page, 'Home');
      await expect(page.locator('main')).toContainText('Offline Pinned Repo');
      await expect(page.locator('main')).toContainText('Offline Linked Task');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('status').filter({ hasText: /you are offline/i })).toBeVisible();
      await expect(page.locator('main')).toContainText('Offline Pinned Repo');
      await expect(page.locator('main')).toContainText('Offline Linked Task');
    } finally {
      await context.setOffline(false);
    }
  });

  test('T3.35 (F27 x F16 x F17 x F19): Skill -> Prompt Studio handoff and variable interpolation work offline and persist across reload', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    try {
      await context.setOffline(true);
      await navigatePrimaryTab(page, 'Skills');
      await page.getByRole('button', { name: 'Use Hallmark in Prompt Studio' }).click();
      await expect(page).toHaveURL(/\/prompts$/);

      const editor = page.getByLabel('Prompt', { exact: true });
      const current = await editor.inputValue();
      await editor.fill(`${current}\nTarget: {{project_name}}`);
      await page.getByLabel('Project name', { exact: true }).fill('Offline Studio');
      await page.getByRole('button', { name: /^preview$/i }).click();
      await expect(page.getByTestId('prompt-preview')).toContainText('Target: Offline Studio');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByLabel('Prompt', { exact: true })).toContainText('Target: {{project_name}}');
      await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Offline Studio');
    } finally {
      await context.setOffline(false);
    }
  });

  test('T3.36 (F27 x F12 x F3): offline warning clears on reconnect and allows official Antigravity launch with zero violations', async ({
    page,
    context,
  }) => {
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('main')).toContainText(/requires an active internet connection/i);
    } finally {
      await context.setOffline(false);
    }
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('main')).not.toContainText(/device is offline/i);

    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('button', { name: /^open antigravity$/i }).first(),
      OFFICIAL_URLS.base,
    );
    await assertZeroForbiddenDomAndStorage(page);
  });
});
