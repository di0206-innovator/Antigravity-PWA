import { expect, test, type Page } from '@playwright/test';
import {
  assertTouchTargetSize,
  assertZeroHorizontalOverflow,
  attachErrorListeners,
  attachSecurityNetworkGuard,
  createProjectViaUi,
  createSkillViaUi,
  createTaskViaUi,
  createWorkflowViaUi,
  expectHeading,
  installClipboardSpy,
  installWindowOpenSpy,
  navigateDrawerRoute,
  navigatePrimaryTab,
  PRIMARY_NAV_LABELS,
  resetAppState,
  ROUTES,
  verifyFocusTrappedInDialog,
  VIEWPORT_WIDTHS,
  type ErrorCollector,
  type SecurityNetworkGuard,
} from './helpers/app';

let errors: ErrorCollector;
let networkGuard: SecurityNetworkGuard;

const ALL_STATIC_ROUTES = [
  ROUTES.home,
  ROUTES.projects,
  ROUTES.prompts,
  ROUTES.skills,
  ROUTES.workflows,
  ROUTES.tasks,
  ROUTES.activity,
  ROUTES.setup,
  ROUTES.settings,
  ROUTES.privacy,
] as const;

const PORTRAIT_VIEWPORTS: Record<(typeof VIEWPORT_WIDTHS)[number], { width: number; height: number }> = {
  320: { width: 320, height: 568 },
  360: { width: 360, height: 640 },
  375: { width: 375, height: 667 },
  390: { width: 390, height: 844 },
  393: { width: 393, height: 852 },
  430: { width: 430, height: 932 },
  768: { width: 768, height: 1024 },
  1024: { width: 1024, height: 1366 },
  1440: { width: 1440, height: 1600 },
};

const LANDSCAPE_VIEWPORTS: Record<(typeof VIEWPORT_WIDTHS)[number], { width: number; height: number }> = {
  320: { width: 568, height: 320 },
  360: { width: 640, height: 360 },
  375: { width: 667, height: 375 },
  390: { width: 844, height: 390 },
  393: { width: 852, height: 393 },
  430: { width: 932, height: 430 },
  768: { width: 768, height: 576 },
  1024: { width: 1024, height: 768 },
  1440: { width: 1440, height: 900 },
};

async function createSampleProjectAndGetDetailPath(page: Page): Promise<string> {
  await createProjectViaUi(page, {
    title: 'Responsive Matrix Project',
    category: 'Web Development',
    machineName: 'mbp-m3',
    workspaceLabel: '~/workspace/responsive-matrix',
    officialUrl: 'https://antigravity.google.com/r/responsive-matrix',
    pinned: true,
  });
  await page.getByRole('link', { name: 'Responsive Matrix Project' }).click();
  await expect(page).toHaveURL(/\/projects\/.+$/);
  return new URL(page.url()).pathname;
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

test.describe('Tier 4 — Width x Orientation Responsive Matrix (9 Widths x Portrait & Landscape)', () => {
  for (const width of VIEWPORT_WIDTHS) {
    const portraitVp = PORTRAIT_VIEWPORTS[width];
    test(`R1-Portrait (${width}px -> ${portraitVp.width}x${portraitVp.height}): all 10 routes + /projects/:id have zero horizontal overflow`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        '9-width viewport sweep runs once on desktop-chromium to avoid isMobile conflicts',
      );
      const detailPath = await createSampleProjectAndGetDetailPath(page);
      await page.setViewportSize(portraitVp);

      for (const route of [...ALL_STATIC_ROUTES, detailPath]) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main')).toBeVisible();
        await assertZeroHorizontalOverflow(page);
      }
    });

    const landscapeVp = LANDSCAPE_VIEWPORTS[width];
    test(`R1-Landscape (${width}px -> ${landscapeVp.width}x${landscapeVp.height}): all 10 routes + /projects/:id have zero horizontal overflow`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        '9-width viewport sweep runs once on desktop-chromium to avoid isMobile conflicts',
      );
      const detailPath = await createSampleProjectAndGetDetailPath(page);
      await page.setViewportSize(landscapeVp);

      for (const route of [...ALL_STATIC_ROUTES, detailPath]) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main')).toBeVisible();
        await assertZeroHorizontalOverflow(page);
      }
    });
  }
});

test.describe('Tier 4 — Populated-Data Responsive Stress (320px & 390px)', () => {
  test('S1 (320px): Home, Projects, and Project Detail contain long unbroken strings without horizontal overflow', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit 320px stress check');
    await page.setViewportSize({ width: 320, height: 640 });
    const longTitle = 'P'.repeat(140);
    const longWorkspace = 'W'.repeat(160);
    const longUrl = `https://antigravity.google.com/r/${'session-'.repeat(8)}end?p=${'q'.repeat(40)}`;
    await createProjectViaUi(page, {
      title: longTitle,
      machineName: 'M'.repeat(120),
      workspaceLabel: longWorkspace,
      officialUrl: longUrl,
      pinned: true,
    });
    await assertZeroHorizontalOverflow(page);

    await page.getByRole('link', { name: longTitle }).click();
    await expectHeading(page, longTitle);
    await assertZeroHorizontalOverflow(page);

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText(longTitle);
    await assertZeroHorizontalOverflow(page);
  });

  test('S2 (320px): Prompt Studio preview, Skill Deck expanded, and Workflow Library expanded contain long tokens cleanly', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit 320px stress check');
    await page.setViewportSize({ width: 320, height: 640 });

    await navigatePrimaryTab(page, 'Prompts');
    const longToken = 'TOKEN_'.repeat(30);
    await page.getByLabel('Prompt', { exact: true }).fill('Inspect {{project_name}}');
    await page.getByLabel('Project name', { exact: true }).fill(longToken);
    await page.getByRole('button', { name: /^preview$/i }).click();
    await expect(page.getByTestId('prompt-preview')).toContainText(longToken);
    await assertZeroHorizontalOverflow(page);

    await createSkillViaUi(page, {
      name: 'StressSkill_' + 'S'.repeat(60),
      instructions: 'Instruction_' + 'I'.repeat(120),
      samplePrompt: 'Sample_' + 'P'.repeat(120),
      tags: 'stress, responsive',
    });
    await page.getByRole('button', { name: /show details for StressSkill_/i }).click();
    await assertZeroHorizontalOverflow(page);

    await createWorkflowViaUi(page, {
      title: 'StressWorkflow_' + 'W'.repeat(60),
      steps: ['Step_' + 'K'.repeat(120)],
      copyablePrompt: 'Copy_' + 'C'.repeat(120),
    });
    await page.getByRole('button', { name: /show details for StressWorkflow_/i }).click();
    await assertZeroHorizontalOverflow(page);
  });

  test('S3 (390px): Task Board List and Kanban views contain long unbroken task titles and overdue badges without overflow', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit 390px stress check');
    await page.setViewportSize({ width: 390, height: 844 });
    await createTaskViaUi(page, {
      title: 'Task_' + 'T'.repeat(130),
      description: 'Desc_' + 'D'.repeat(160),
      priority: 'Critical',
      dueDate: '2020-01-15',
    });
    await assertZeroHorizontalOverflow(page);

    await page.getByRole('button', { name: /^kanban$/i }).click();
    await expect(page.getByTestId('task-kanban')).toBeVisible();
    await assertZeroHorizontalOverflow(page);
  });
});

test.describe('Tier 4 — Touch Target >= 44x44 CSS px Verification (F8)', () => {
  test('T1: primary bottom nav items, header controls, and Home OPEN ANTIGRAVITY meet >=44x44px at 320px and 390px', async ({
    page,
  }) => {
    for (const vp of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(vp);
      const nav = page.getByRole('navigation', { name: 'Primary navigation' });
      for (const label of PRIMARY_NAV_LABELS) {
        await assertTouchTargetSize(nav.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }));
      }

      const header = page.locator('header').first();
      await assertTouchTargetSize(header.getByRole('link', { name: /ag pocket/i }));
      await assertTouchTargetSize(header.getByRole('link', { name: /open settings/i }));
      await assertTouchTargetSize(header.getByRole('button', { name: /open navigation menu/i }));

      await assertTouchTargetSize(
        page.locator('main').getByRole('button', { name: /open antigravity/i }).first(),
      );
    }
  });

  test('T2: Prompt Studio, Projects, and Task Board primary action buttons meet >=44x44px touch targets', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await navigatePrimaryTab(page, 'Prompts');
    await assertTouchTargetSize(page.getByRole('button', { name: /^copy prompt$/i }));
    await assertTouchTargetSize(page.getByRole('button', { name: /^preview$/i }));
    await assertTouchTargetSize(page.getByRole('button', { name: /^templates$/i }));
    await assertTouchTargetSize(page.getByRole('button', { name: /^save as template$/i }));
    await assertTouchTargetSize(page.getByRole('button', { name: /^clear$/i }));

    await navigatePrimaryTab(page, 'Projects');
    await assertTouchTargetSize(
      page
        .getByRole('button', { name: /^new project$/i })
        .or(page.getByRole('button', { name: /^create your first project$/i }))
        .first(),
    );

    await navigateDrawerRoute(page, /task board/i);
    await assertTouchTargetSize(page.getByRole('button', { name: /^new task$/i }).first());
  });

  test('T3: form sheet actions and navigation drawer controls meet >=44x44px touch targets', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole('button', { name: /open navigation menu/i }).click();
    const drawer = page.getByRole('dialog', { name: /navigation menu/i });
    await assertTouchTargetSize(drawer.getByRole('button', { name: /close navigation menu/i }));
    await assertTouchTargetSize(drawer.getByRole('button', { name: /^open antigravity$/i }));
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();
    const projectSheet = page.getByRole('dialog', { name: 'New project' });
    await assertTouchTargetSize(projectSheet.getByRole('button', { name: /^close new project$/i }));
    await assertTouchTargetSize(projectSheet.getByRole('button', { name: /^create project$/i }));
    await assertTouchTargetSize(projectSheet.getByRole('button', { name: /^cancel$/i }));
    await page.keyboard.press('Escape');
    await expect(projectSheet).toBeHidden();
  });
});

test.describe('Tier 4 — Mobile & Tablet Touch Emulation', () => {
  test('M1: touch tap() opens, navigates, and closes Navigation drawer cleanly', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'desktop-chromium',
      'Touch tap() requires hasTouch context (mobile-chromium / tablet-chromium)',
    );

    await page.getByRole('button', { name: /open navigation menu/i }).tap();
    const drawer = page.getByRole('dialog', { name: /navigation menu/i });
    await expect(drawer).toBeVisible();
    await assertZeroHorizontalOverflow(page);

    await drawer.getByRole('button', { name: /close navigation menu/i }).tap();
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: /open navigation menu/i }).tap();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: /workflow library/i }).tap();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/workflows$/);
    await expectHeading(page, /workflow library/i);
    await assertZeroHorizontalOverflow(page);
  });

  test('M2: touch tap() across all 5 primary bottom nav tabs preserves ergonomics and zero overflow', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'desktop-chromium',
      'Touch tap() requires hasTouch context (mobile-chromium / tablet-chromium)',
    );

    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    for (const label of PRIMARY_NAV_LABELS) {
      const link = nav.getByRole('link', { name: new RegExp(`^${label}$`, 'i') });
      await link.tap();
      await expect(link).toHaveAttribute('aria-current', 'page');
      await assertZeroHorizontalOverflow(page);
    }
  });

  test('M3: Kanban renders mobile status tablist (<768px) on mobile-chromium vs 5-column grid (>=768px) on tablet-chromium', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'desktop-chromium',
      'Device-emulated Kanban check runs on mobile-chromium and tablet-chromium',
    );

    await createTaskViaUi(page, { title: 'Device Kanban Task', status: 'In Progress' });
    await page.getByRole('button', { name: /^kanban$/i }).tap();
    await expect(page.getByTestId('task-kanban')).toBeVisible();

    const tablist = page.getByRole('tablist', { name: 'Task status' });
    if (testInfo.project.name === 'mobile-chromium') {
      await expect(tablist).toBeVisible();
      await expect(page.getByTestId('column-In Progress')).toBeHidden();
      await tablist.getByRole('tab', { name: /^In Progress \(1\)$/ }).tap();
      await expect(page.getByTestId('column-In Progress')).toBeVisible();
      await expect(page.getByTestId('column-In Progress')).toContainText('Device Kanban Task');
    } else {
      await expect(tablist).toBeHidden();
      await expect(page.getByTestId('column-Backlog')).toBeVisible();
      await expect(page.getByTestId('column-Planned')).toBeVisible();
      await expect(page.getByTestId('column-In Progress')).toBeVisible();
      await expect(page.getByTestId('column-Needs Attention')).toBeVisible();
      await expect(page.getByTestId('column-Completed')).toBeVisible();
    }
    await assertZeroHorizontalOverflow(page);
  });
});

test.describe('Tier 4 — Virtual Keyboard Resize & Dialog Focus Traps', () => {
  test('K1: virtual keyboard resize (390x844 -> 390x420) on Prompt Studio keeps editor, variables, and Copy prompt usable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigatePrimaryTab(page, 'Prompts');
    const editor = page.getByLabel('Prompt', { exact: true });
    await editor.fill('Build {{project_name}} mobile keyboard layout.');
    await editor.focus();

    await page.setViewportSize({ width: 390, height: 420 });
    await assertZeroHorizontalOverflow(page);

    const varInput = page.getByLabel('Project name', { exact: true });
    await varInput.scrollIntoViewIfNeeded();
    await expect(varInput).toBeVisible();
    await varInput.fill('AG Pocket');

    const copyBtn = page.getByRole('button', { name: /^copy prompt$/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(page.getByRole('status').filter({ hasText: /prompt copied/i })).toBeVisible();
  });

  test('K2: virtual keyboard resize (390x844 -> 390x420) keeps ProjectFormSheet & TaskFormSheet scrollable and submittable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();
    const projectSheet = page.getByRole('dialog', { name: 'New project' });
    await expect(projectSheet).toBeVisible();

    await page.setViewportSize({ width: 390, height: 420 });
    await projectSheet.getByLabel(/^title$/i).fill('Keyboard Safe Project');
    const createProjectBtn = projectSheet.getByRole('button', { name: /^create project$/i });
    await createProjectBtn.scrollIntoViewIfNeeded();
    await expect(createProjectBtn).toBeVisible();
    await createProjectBtn.click();
    await expect(projectSheet).toBeHidden();
    await expect(page.getByRole('link', { name: 'Keyboard Safe Project' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await navigateDrawerRoute(page, /task board/i);
    await page.getByRole('button', { name: /^new task$/i }).first().click();
    const taskSheet = page.getByRole('dialog', { name: 'New task' });
    await expect(taskSheet).toBeVisible();

    await page.setViewportSize({ width: 390, height: 420 });
    await taskSheet.getByLabel(/^title$/i).fill('Keyboard Safe Task');
    const createTaskBtn = taskSheet.getByRole('button', { name: /^create task$/i });
    await createTaskBtn.scrollIntoViewIfNeeded();
    await expect(createTaskBtn).toBeVisible();
    await createTaskBtn.click();
    await expect(taskSheet).toBeHidden();
    await expect(page.getByTestId('task-card').filter({ hasText: 'Keyboard Safe Task' })).toBeVisible();
  });

  test('K3: focus stays trapped inside open Navigation drawer, New project sheet, and New task sheet on Tab/Shift+Tab', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // 1. Navigation drawer focus trap + Escape restoration
    const menuBtn = page.getByRole('button', { name: /open navigation menu/i });
    await menuBtn.focus();
    await menuBtn.click();
    const drawer = page.getByRole('dialog', { name: /navigation menu/i });
    await verifyFocusTrappedInDialog(page, drawer);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menuBtn).toBeFocused();

    // 2. ProjectFormSheet focus trap + Escape restoration
    await navigatePrimaryTab(page, 'Projects');
    const newProjBtn = page.getByRole('button', { name: /^new project$/i }).first();
    await newProjBtn.focus();
    await newProjBtn.click();
    const projectSheet = page.getByRole('dialog', { name: 'New project' });
    await verifyFocusTrappedInDialog(page, projectSheet);
    await page.keyboard.press('Escape');
    await expect(projectSheet).toBeHidden();
    await expect(newProjBtn).toBeFocused();

    // 3. TaskFormSheet focus trap + Escape restoration
    await navigateDrawerRoute(page, /task board/i);
    const newTaskBtn = page.getByRole('button', { name: /^new task$/i }).first();
    await newTaskBtn.focus();
    await newTaskBtn.click();
    const taskSheet = page.getByRole('dialog', { name: 'New task' });
    await verifyFocusTrappedInDialog(page, taskSheet);
    await page.keyboard.press('Escape');
    await expect(taskSheet).toBeHidden();
    await expect(newTaskBtn).toBeFocused();
  });
});
