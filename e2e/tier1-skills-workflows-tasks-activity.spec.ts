import { expect, test } from '@playwright/test';
import {
  assertZeroHorizontalOverflow,
  attachErrorListeners,
  attachSecurityNetworkGuard,
  createProjectViaUi,
  createTaskViaUi,
  expectHeading,
  getCopiedTexts,
  installClipboardSpy,
  installWindowOpenSpy,
  navigateDrawerRoute,
  navigatePrimaryTab,
  resetAppState,
  SKILL_CATEGORIES,
  STARTER_SKILL_NAMES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  WORKFLOW_CATEGORIES,
  type ErrorCollector,
  type SecurityNetworkGuard,
} from './helpers/app';

let errors: ErrorCollector;
let networkGuard: SecurityNetworkGuard;

const ACTIVITY_CATEGORY_VALUES = [
  'project',
  'prompt',
  'skill',
  'workflow',
  'task',
  'setup',
  'system',
] as const;

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

test.describe('F19 — Skill Deck Catalogue, CRUD, 10 Categories, Favourites & Insert', () => {
  test('F19.1: Skill Deck renders explicit disclosure banner that desktop skills cannot be inspected', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await expectHeading(page, /^skill deck$/i);

    const main = page.locator('main');
    await expect(main).toContainText('Manually maintained local reference');
    await expect(main).toContainText('AG Pocket cannot inspect the skills installed on your desktop');
    errors.assertNoErrors();
  });

  test('F19.2: Category select exposes all 10 SKILL_CATEGORIES and filters skills accurately', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');

    const categorySelect = page.getByLabel(/^category$/i);
    const options = await categorySelect.locator('option').allTextContents();
    expect(options).toEqual(['All categories', ...SKILL_CATEGORIES]);

    await categorySelect.selectOption('Security');
    await expect(page.getByRole('heading', { level: 2, name: 'Security Review' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Hallmark' })).toHaveCount(0);

    await categorySelect.selectOption('Testing');
    await expect(page.getByRole('heading', { level: 2, name: 'Testing and QA' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Security Review' })).toHaveCount(0);

    await categorySelect.selectOption('Backend');
    await expect(page.locator('main')).toContainText('No matching skills');
    errors.assertNoErrors();
  });

  test('F19.3: searching skills filters by name, tag, and text with "No matching skills" fallback', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    const search = page.getByLabel(/search skills/i);

    await search.fill('Swarm');
    await expect(page.getByRole('heading', { level: 2, name: 'Swarm' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Hallmark' })).toHaveCount(0);

    await search.fill('no-such-skill-999');
    await expect(page.locator('main')).toContainText('No matching skills');

    await search.fill('');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(STARTER_SKILL_NAMES.length);
    errors.assertNoErrors();
  });

  test('F19.4: "Favourites only" toggle updates aria-pressed and filters to starred skills only', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    const favToggle = page.getByRole('button', { name: /favourites only/i });
    await expect(favToggle).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Add Code Review to favourites' }).click();
    await expect(page.getByRole('button', { name: 'Remove Code Review from favourites' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await favToggle.click();
    await expect(favToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 2, name: 'Code Review' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);

    await favToggle.click();
    await expect(favToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(STARTER_SKILL_NAMES.length);
    errors.assertNoErrors();
  });

  test('F19.5: create, validate, edit, and delete a custom skill with reload persistence', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: /^new skill$/i }).click();

    const dialog = page.getByRole('dialog', { name: 'New skill' });
    await expect(dialog).toBeVisible();

    // Validation errors on empty submission.
    await dialog.getByRole('button', { name: /^create skill$/i }).click();
    await expect(dialog.getByRole('alert')).toContainText('Skill name is required.');
    await expect(dialog.getByRole('alert')).toContainText('Skill instructions are required.');

    await dialog.getByLabel(/^name$/i).fill('Accessibility Auditor');
    await dialog.getByLabel(/^category$/i).selectOption('Frontend');
    await dialog.getByLabel(/^description$/i).fill('WCAG AA verification checklist');
    await dialog.getByLabel(/^usage instructions$/i).fill('Check landmarks, contrast, and 44px touch targets.');
    await dialog.getByLabel(/^sample prompt$/i).fill('Audit the current route for WCAG AA compliance.');
    await dialog.getByLabel(/^tags$/i).fill('a11y, wcag');
    await dialog.getByRole('button', { name: /^create skill$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('heading', { level: 2, name: 'Accessibility Auditor' })).toBeVisible();

    // Reload persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 2, name: 'Accessibility Auditor' })).toBeVisible();

    // Edit custom skill
    await page.getByRole('button', { name: 'Edit Accessibility Auditor' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit skill' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel(/^name$/i).fill('Accessibility Auditor Pro');
    await editDialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(editDialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'Accessibility Auditor Pro' })).toBeVisible();

    // Delete custom skill via inline alertdialog -> Confirm delete
    await page.getByRole('button', { name: 'Delete Accessibility Auditor Pro' }).click();
    const confirmAlert = page.getByRole('alertdialog', {
      name: 'Confirm delete Accessibility Auditor Pro',
    });
    await expect(confirmAlert).toBeVisible();
    await confirmAlert.getByRole('button', { name: /^confirm delete$/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Accessibility Auditor Pro' })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F19.6: Copy to clipboard copies skill body and Use in Prompt Studio hands off into /prompts', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Copy Hallmark to clipboard' }).click();
    await expect.poll(async () => (await getCopiedTexts(page)).length).toBeGreaterThan(0);

    const copied = await getCopiedTexts(page);
    expect(copied[copied.length - 1].length).toBeGreaterThan(20);

    await page.getByRole('button', { name: 'Use Hallmark in Prompt Studio' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expectHeading(page, /prompt studio/i);

    const editorBody = await page.getByLabel(/^prompt$/i).inputValue();
    expect(editorBody).toContain(copied[copied.length - 1]);
    errors.assertNoErrors();
  });
});

test.describe('F20 — Skill Deck 9 Starter Skills', () => {
  test('F20.1: all 9 STARTER_SKILL_NAMES are present on first load', async ({ page }) => {
    await navigatePrimaryTab(page, 'Skills');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(STARTER_SKILL_NAMES.length);

    for (const name of STARTER_SKILL_NAMES) {
      await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    }
    errors.assertNoErrors();
  });

  test('F20.2: skill details are collapsed by default and Show details reveals Usage instructions and Sample prompt', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    const card = page.getByRole('region', { name: 'Teamwork' });
    await expect(card).toBeVisible();

    await expect(card.getByRole('heading', { level: 3, name: 'Usage instructions' })).toHaveCount(0);
    await expect(card.getByRole('heading', { level: 3, name: 'Sample prompt' })).toHaveCount(0);

    const showBtn = card.getByRole('button', { name: 'Show details for Teamwork' });
    await expect(showBtn).toHaveAttribute('aria-expanded', 'false');
    await showBtn.click();

    const hideBtn = card.getByRole('button', { name: 'Hide details for Teamwork' });
    await expect(hideBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(card.getByRole('heading', { level: 3, name: 'Usage instructions' })).toBeVisible();
    await expect(card.getByRole('heading', { level: 3, name: 'Sample prompt' })).toBeVisible();

    await hideBtn.click();
    await expect(card.getByRole('heading', { level: 3, name: 'Usage instructions' })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F20.3: editing a starter skill persists updated content across full reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Edit Swarm' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit skill' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^description$/i).fill('Updated multi-agent fan-out notes');
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('region', { name: 'Swarm' })).toContainText(
      'Updated multi-agent fan-out notes',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: 'Swarm' })).toContainText(
      'Updated multi-agent fan-out notes',
    );
    errors.assertNoErrors();
  });

  test('F20.4: starter seeding is idempotent across reloads and deleting a starter skill stays deleted', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(STARTER_SKILL_NAMES.length);

    // Reload without modifications: still 9.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(STARTER_SKILL_NAMES.length);

    // Delete one starter skill.
    await page.getByRole('button', { name: 'Delete Red Antigravity Skills' }).click();
    await page
      .getByRole('alertdialog', { name: 'Confirm delete Red Antigravity Skills' })
      .getByRole('button', { name: /^confirm delete$/i })
      .click();
    await expect(page.getByRole('heading', { level: 2, name: 'Red Antigravity Skills' })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 2, name: 'Red Antigravity Skills' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(
      STARTER_SKILL_NAMES.length - 1,
    );
    errors.assertNoErrors();
  });

  test('F20.5: toggling favourite on a starter skill persists across reload and appears on Project Detail', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Skill Suggest Project' });

    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Add Frontend Engineering to favourites' }).click();
    await expect(
      page.getByRole('button', { name: 'Remove Frontend Engineering from favourites' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: 'Remove Frontend Engineering from favourites' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('link', { name: 'Skill Suggest Project' }).click();
    await expect(page.locator('main')).toContainText('Frontend Engineering');
    errors.assertNoErrors();
  });
});

test.describe('F21 — Workflow Library Starter & Custom Workflows', () => {
  test('F21.1: Workflow Library displays "Local reference only" banner and all 4 starter category sections', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow/i);
    await expectHeading(page, /workflow library/i);

    const main = page.locator('main');
    await expect(main).toContainText('Local reference only');
    await expect(main).toContainText('nothing is sent to Antigravity');

    for (const starterCat of [
      'Development',
      'Frontend',
      'AI Engineering',
      'Release Engineering',
    ]) {
      await expect(main.getByRole('heading', { level: 2, name: starterCat })).toBeVisible();
    }
    errors.assertNoErrors();
  });

  test('F21.2: Show details reveals ordered Steps (<ol>), Related skills links to /skills, and Prompt', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow/i);
    await expectHeading(page, /workflow library/i);

    const card = page.getByRole('region', { name: 'End-to-End Feature Delivery' });
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { level: 4, name: 'Steps' })).toHaveCount(0);

    await card.getByRole('button', { name: 'Show details for End-to-End Feature Delivery' }).click();
    await expect(card.getByRole('heading', { level: 4, name: 'Steps' })).toBeVisible();
    await expect(card.getByRole('list').getByRole('listitem').first()).toBeVisible();
    await expect(card.getByRole('heading', { level: 4, name: 'Related skills' })).toBeVisible();
    await expect(card.getByRole('link').first()).toBeVisible();
    await expect(card.getByRole('heading', { level: 4, name: 'Prompt' })).toBeVisible();
    errors.assertNoErrors();
  });

  test('F21.3: creating a custom workflow supports Add step, Remove step 1, and validation errors', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow/i);
    await expectHeading(page, /workflow library/i);

    await page.getByRole('button', { name: /^new workflow$/i }).click();
    const dialog = page.getByRole('dialog', { name: 'New workflow' });
    await expect(dialog).toBeVisible();

    // Validation errors for missing title and empty steps.
    await dialog.getByRole('button', { name: /^create workflow$/i }).click();
    await expect(dialog.getByRole('alert')).toContainText('Workflow title is required.');
    await expect(dialog.getByRole('alert')).toContainText('At least one step is required.');

    await dialog.getByLabel(/^title$/i).fill('Hotfix Verification Loop');
    await dialog.getByLabel(/^category$/i).selectOption('Custom');
    await dialog.getByLabel(/^description$/i).fill('Rapid triage and regression check');
    await dialog.getByLabel(/^step 1$/i).fill('Obsolete step to remove');
    await dialog.getByRole('button', { name: /^add step$/i }).click();
    await dialog.getByLabel(/^step 2$/i).fill('Reproduce failure in isolated test');
    await dialog.getByRole('button', { name: 'Remove step 1' }).click();

    // Former Step 2 is now Step 1; add a second step.
    await expect(dialog.getByLabel(/^step 1$/i)).toHaveValue('Reproduce failure in isolated test');
    await dialog.getByRole('button', { name: /^add step$/i }).click();
    await dialog.getByLabel(/^step 2$/i).fill('Verify build and lint before release');

    await dialog.getByLabel(/^related skills$/i).fill('Testing and QA, Code Review');
    await dialog.getByLabel(/^copyable prompt$/i).fill('Run the hotfix verification checklist.');
    await dialog.getByLabel(/^tags$/i).fill('hotfix, release');
    await dialog.getByRole('button', { name: /^create workflow$/i }).click();
    await expect(dialog).toBeHidden();

    const card = page.getByRole('region', { name: 'Hotfix Verification Loop' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Show details for Hotfix Verification Loop' }).click();
    await expect(card.getByRole('list').getByRole('listitem')).toHaveCount(2);
    await expect(card).toContainText('Reproduce failure in isolated test');
    await expect(card).toContainText('Verify build and lint before release');
    errors.assertNoErrors();
  });

  test('F21.4: editing and deleting a custom workflow persists across reload', async ({ page }) => {
    await navigateDrawerRoute(page, /workflow/i);
    await expectHeading(page, /workflow library/i);

    await page.getByRole('button', { name: /^new workflow$/i }).click();
    const dialog = page.getByRole('dialog', { name: 'New workflow' });
    await dialog.getByLabel(/^title$/i).fill('Temp Custom Flow');
    await dialog.getByLabel(/^step 1$/i).fill('Initial step');
    await dialog.getByRole('button', { name: /^create workflow$/i }).click();
    await expect(dialog).toBeHidden();

    // Edit workflow
    await page.getByRole('button', { name: 'Edit Temp Custom Flow' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit workflow' });
    await editDialog.getByLabel(/^title$/i).fill('Renamed Custom Flow');
    await editDialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(editDialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 3, name: 'Renamed Custom Flow' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 3, name: 'Renamed Custom Flow' })).toBeVisible();

    // Delete workflow
    await page.getByRole('button', { name: 'Delete Renamed Custom Flow' }).click();
    await page
      .getByRole('alertdialog', { name: 'Confirm delete Renamed Custom Flow' })
      .getByRole('button', { name: /^confirm delete$/i })
      .click();
    await expect(page.getByRole('heading', { level: 3, name: 'Renamed Custom Flow' })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 3, name: 'Renamed Custom Flow' })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F21.5: Copy prompt and Use in Prompt Studio hand off workflow prompt cleanly', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow/i);
    await expectHeading(page, /workflow library/i);

    await page.getByRole('button', { name: 'Copy prompt for Mobile-First PWA UI Polish' }).click();
    await expect.poll(async () => (await getCopiedTexts(page)).length).toBeGreaterThan(0);

    const copied = await getCopiedTexts(page);
    const workflowPrompt = copied[copied.length - 1];
    expect(workflowPrompt.length).toBeGreaterThan(15);

    await page.getByRole('button', { name: 'Use Mobile-First PWA UI Polish in Prompt Studio' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expectHeading(page, /prompt studio/i);
    const editorVal = await page.getByLabel(/^prompt$/i).inputValue();
    expect(editorVal).toContain(workflowPrompt);
    errors.assertNoErrors();
  });

  test('F21.6: searching workflows and filtering across WORKFLOW_CATEGORIES works accurately', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow/i);
    await expectHeading(page, /workflow library/i);

    const categorySelect = page.getByLabel(/^category$/i);
    const options = await categorySelect.locator('option').allTextContents();
    expect(options).toEqual(['All categories', ...WORKFLOW_CATEGORIES]);

    await categorySelect.selectOption('Release Engineering');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Release Engineering' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Frontend' })).toHaveCount(0);

    await categorySelect.selectOption('all');
    const search = page.getByLabel(/search workflows/i);
    await search.fill('Implement RAG');
    await expect(page.getByRole('heading', { level: 3, name: 'Implement RAG' })).toBeVisible();

    await search.fill('nonexistent-workflow-xyz');
    await expect(page.locator('main')).toContainText('No matching workflows');
    errors.assertNoErrors();
  });
});

test.describe('F22 — Task Board Personal CRUD, 5 Statuses, 4 Priorities, List + Mobile-Safe Kanban', () => {
  test('F22.1: Task Board displays non-live disclosure banner and "No tasks yet" empty state', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /task/i);
    await expectHeading(page, /^task board$/i);

    const main = page.locator('main');
    await expect(main).toContainText(
      'Personal local tracker — manually updated, not synced with live Antigravity agent state',
    );
    await expect(main).toContainText('No tasks yet');
    errors.assertNoErrors();
  });

  test('F22.2: creating a task defaults Status to Backlog, validates required title, and saves all fields', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Task Host Project' });

    await navigateDrawerRoute(page, /task/i);
    await expectHeading(page, /^task board$/i);
    await page.getByRole('button', { name: /^new task$/i }).first().click();

    const dialog = page.getByRole('dialog', { name: 'New task' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/^status$/i)).toHaveValue('Backlog');
    await expect(dialog.getByLabel(/^priority$/i)).toHaveValue('Medium');

    // Empty title validation.
    await dialog.getByRole('button', { name: /^create task$/i }).click();
    await expect(dialog.getByRole('alert')).toContainText('Task title is required.');

    await dialog.getByLabel(/^title$/i).fill('Ship Offline Spec');
    await dialog.getByLabel(/^description$/i).fill('Verify SW offline behavior');
    await dialog.getByLabel(/^project$/i).selectOption({ label: 'Task Host Project' });
    await dialog.getByLabel(/^status$/i).selectOption('Planned');
    await dialog.getByLabel(/^priority$/i).selectOption('High');
    await dialog.getByLabel(/^due date$/i).fill('2099-12-31');
    await dialog.getByLabel(/^notes$/i).fill('Run in headless chromium.');
    await dialog.getByRole('button', { name: /^create task$/i }).click();
    await expect(dialog).toBeHidden();

    const card = page.getByTestId('task-card').filter({ hasText: 'Ship Offline Spec' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('High');
    await expect(card).toContainText('Task Host Project');
    await expect(card).toContainText('Due 2099-12-31');
    await expect(card.getByLabel('Status for Ship Offline Spec')).toHaveValue('Planned');
    errors.assertNoErrors();
  });

  test('F22.3: List and Kanban views toggle aria-pressed and display all 5 status columns on >=768px viewports', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, { title: 'Kanban Card Alpha', status: 'In Progress' });

    const listBtn = page.getByRole('button', { name: /^list$/i });
    const kanbanBtn = page.getByRole('button', { name: /^kanban$/i });
    await expect(listBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(kanbanBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('task-list')).toBeVisible();

    await kanbanBtn.click();
    await expect(kanbanBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('task-kanban')).toBeVisible();

    for (const status of TASK_STATUSES) {
      await expect(page.getByTestId(`column-${status}`)).toBeVisible();
    }
    await expect(page.getByTestId('column-In Progress')).toContainText('Kanban Card Alpha');
    await expect(page.getByTestId('column-Backlog')).toContainText('No tasks');
    errors.assertNoErrors();
  });

  test('F22.4: mobile Kanban (390x844) renders status tablist switching columns with zero horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, { title: 'Mobile Backlog Task', status: 'Backlog' });
    await createTaskViaUi(page, { title: 'Mobile Attention Task', status: 'Needs Attention' });

    await page.getByRole('button', { name: /^kanban$/i }).click();
    const tablist = page.getByRole('tablist', { name: 'Task status' });
    await expect(tablist).toBeVisible();

    // Default tab is Backlog.
    await expect(tablist.getByRole('tab', { name: /^Backlog \(1\)$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('column-Backlog')).toContainText('Mobile Backlog Task');
    await expect(page.getByTestId('column-Needs Attention')).toBeHidden();

    // Switch tab to Needs Attention.
    await tablist.getByRole('tab', { name: /^Needs Attention \(1\)$/ }).click();
    await expect(page.getByTestId('column-Needs Attention')).toBeVisible();
    await expect(page.getByTestId('column-Needs Attention')).toContainText('Mobile Attention Task');
    await expect(page.getByTestId('column-Backlog')).toBeHidden();

    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test('F22.5: inline status selector transitions a task across all 5 TASK_STATUSES and persists on reload', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, { title: 'Lifecycle Task' });

    const statusSelect = page.getByLabel('Status for Lifecycle Task');
    await expect(statusSelect).toHaveValue('Backlog');

    for (const status of TASK_STATUSES) {
      await statusSelect.selectOption(status);
      await expect(statusSelect).toHaveValue(status);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Status for Lifecycle Task')).toHaveValue('Completed');
    errors.assertNoErrors();
  });

  test('F22.6: Task Board search, Project filter, and Priority filter across all 4 priorities work with Clear filters', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Filter Project A' });
    await createProjectViaUi(page, { title: 'Filter Project B' });

    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, {
      title: 'Critical Kernel Fix',
      project: 'Filter Project A',
      priority: 'Critical',
    });
    await createTaskViaUi(page, {
      title: 'Low Docs Polish',
      project: 'Filter Project B',
      priority: 'Low',
    });

    const priorityFilter = page.getByLabel(/^priority filter$/i);
    const priorityOptions = await priorityFilter.locator('option').allTextContents();
    expect(priorityOptions).toEqual(['All priorities', ...TASK_PRIORITIES]);

    // Filter by Priority
    await priorityFilter.selectOption('Critical');
    await expect(page.getByTestId('task-card').filter({ hasText: 'Critical Kernel Fix' })).toBeVisible();
    await expect(page.getByTestId('task-card').filter({ hasText: 'Low Docs Polish' })).toHaveCount(0);
    await priorityFilter.selectOption('');

    // Filter by Project
    await page.getByLabel(/^project filter$/i).selectOption({ label: 'Filter Project B' });
    await expect(page.getByTestId('task-card').filter({ hasText: 'Low Docs Polish' })).toBeVisible();
    await expect(page.getByTestId('task-card').filter({ hasText: 'Critical Kernel Fix' })).toHaveCount(0);
    await page.getByLabel(/^project filter$/i).selectOption('');

    // Search + Clear filters recovery
    await page.getByLabel(/^search$/i).fill('no-matching-task-xyz');
    await expect(page.locator('main')).toContainText('No matching tasks');
    await page.getByRole('button', { name: /clear filters/i }).click();
    await expect(page.getByTestId('task-card')).toHaveCount(2);
    errors.assertNoErrors();
  });

  test('F22.7: editing, overdue indicator, and deleting a task ("Delete task?" -> "Confirm delete") persist', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, {
      title: 'Past Due Task',
      dueDate: '2020-01-15',
      priority: 'Medium',
    });

    const card = page.getByTestId('task-card').filter({ hasText: 'Past Due Task' });
    await expect(card).toHaveAttribute('data-overdue', 'true');
    await expect(card).toContainText('Overdue · 2020-01-15');

    // Edit task
    await card.getByRole('button', { name: 'Edit Past Due Task' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit task' });
    await editDialog.getByLabel(/^title$/i).fill('Updated Task Name');
    await editDialog.getByLabel(/^priority$/i).selectOption('Critical');
    await editDialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(editDialog).toBeHidden();

    const updatedCard = page.getByTestId('task-card').filter({ hasText: 'Updated Task Name' });
    await expect(updatedCard).toContainText('Critical');

    // Delete task
    await updatedCard.getByRole('button', { name: 'Delete Updated Task Name' }).click();
    const delDialog = page.getByRole('dialog', { name: 'Delete task?' });
    await expect(delDialog).toBeVisible();
    await delDialog.getByRole('button', { name: /^confirm delete$/i }).click();
    await expect(delDialog).toBeHidden();

    await expect(page.locator('main')).toContainText('No tasks yet');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('No tasks yet');
    errors.assertNoErrors();
  });
});

test.describe('F23 — Activity Log Timeline & Clear History', () => {
  test('F23.1: Activity Log renders "Local only" disclosure, disabled Clear history, and "No activity yet"', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /activity/i);
    await expectHeading(page, /^activity log$/i);

    const main = page.locator('main');
    await expect(main).toContainText('Local only');
    await expect(main).toContainText(
      'This log only records actions taken inside AG Pocket. It does not show Antigravity agent activity.',
    );
    await expect(main).toContainText('No activity yet');
    await expect(page.getByRole('button', { name: /clear history/i })).toBeDisabled();
    errors.assertNoErrors();
  });

  test('F23.2: creating projects, copying prompts, and creating tasks record chronological entries with timestamps & badges', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Activity Tracked Project' });

    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^prompt$/i).fill('Verify activity logging.');
    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await expect.poll(async () => (await getCopiedTexts(page)).length).toBeGreaterThan(0);

    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, { title: 'Activity Tracked Task' });

    await navigateDrawerRoute(page, /activity/i);
    await expectHeading(page, /^activity log$/i);

    const listItems = page.locator('main').getByRole('listitem');
    await expect(listItems).toHaveCount(3);
    // Most recent entry appears first (reverse chronological).
    await expect(listItems.nth(0)).toContainText('Created task "Activity Tracked Task"');
    await expect(listItems.nth(0)).toContainText('task');
    await expect(listItems.nth(0).locator('time')).toBeVisible();

    await expect(listItems.nth(1)).toContainText('Copied prompt');
    await expect(listItems.nth(1)).toContainText('prompt');

    await expect(listItems.nth(2)).toContainText('Created project "Activity Tracked Project"');
    await expect(listItems.nth(2)).toContainText('project');
    errors.assertNoErrors();
  });

  test('F23.3: Category filter exposes all 7 categories and filters entries with "No matching activity" fallback', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Cat Filter Project' });
    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, { title: 'Cat Filter Task' });

    await navigateDrawerRoute(page, /activity/i);
    const categorySelect = page.getByLabel(/^category$/i);
    const options = await categorySelect.locator('option').allTextContents();
    expect(options).toEqual(['All categories', ...ACTIVITY_CATEGORY_VALUES]);

    await categorySelect.selectOption('project');
    await expect(page.locator('main').getByRole('listitem')).toHaveCount(1);
    await expect(page.locator('main')).toContainText('Created project "Cat Filter Project"');

    await categorySelect.selectOption('task');
    await expect(page.locator('main').getByRole('listitem')).toHaveCount(1);
    await expect(page.locator('main')).toContainText('Created task "Cat Filter Task"');

    await categorySelect.selectOption('workflow');
    await expect(page.locator('main')).toContainText('No matching activity');
    errors.assertNoErrors();
  });

  test('F23.4: project-linked actions show the associated project badge in Activity Log', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Badge Link Project' });
    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, {
      title: 'Project Linked Task',
      project: 'Badge Link Project',
    });

    await navigateDrawerRoute(page, /activity/i);
    const taskEntry = page
      .locator('main')
      .getByRole('listitem')
      .filter({ hasText: 'Created task "Project Linked Task"' });
    await expect(taskEntry).toBeVisible();
    await expect(taskEntry).toContainText('task');
    await expect(taskEntry).toContainText('Badge Link Project');
    errors.assertNoErrors();
  });

  test('F23.5: "Clear history" opens confirmation sheet, Cancel keeps entries, and Confirm clear empties timeline persistently', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Clearable Log Project' });
    await navigateDrawerRoute(page, /activity/i);

    const clearBtn = page.getByRole('button', { name: /clear history/i });
    await expect(clearBtn).toBeEnabled();

    // Cancel preserves timeline.
    await clearBtn.click();
    const dialog = page.getByRole('dialog', { name: 'Clear activity history?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main').getByRole('listitem')).toHaveCount(1);

    // Confirm clear empties timeline and persists on reload.
    await clearBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^confirm clear$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.locator('main')).toContainText('No activity yet');
    await expect(clearBtn).toBeDisabled();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('No activity yet');
    errors.assertNoErrors();
  });

  test('F23.6: clearing Activity Log history does not delete projects or tasks', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Preserved Project' });
    await navigateDrawerRoute(page, /task/i);
    await createTaskViaUi(page, { title: 'Preserved Task', project: 'Preserved Project' });

    await navigateDrawerRoute(page, /activity/i);
    await page.getByRole('button', { name: /clear history/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Clear activity history?' });
    await dialog.getByRole('button', { name: /^confirm clear$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('No activity yet');

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.getByRole('link', { name: 'Preserved Project' })).toBeVisible();

    await navigateDrawerRoute(page, /task/i);
    await expect(page.getByTestId('task-card').filter({ hasText: 'Preserved Task' })).toBeVisible();
    networkGuard.assertClean();
    errors.assertNoErrors();
  });
});
