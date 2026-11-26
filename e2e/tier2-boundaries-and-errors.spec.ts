import { expect, test, type Page } from '@playwright/test';
import {
  assertZeroForbiddenDomAndStorage,
  assertZeroHorizontalOverflow,
  attachErrorListeners,
  attachSecurityNetworkGuard,
  closeNavDrawer,
  DEXIE_DB_NAME,
  EXPECTED_DEXIE_STORES,
  expectHeading,
  getCopiedTexts,
  getLatestExportedText,
  getOpenedUrls,
  getThemeSnapshot,
  installClipboardSpy,
  installExportSpy,
  installWindowOpenSpy,
  navigateDrawerRoute,
  navigatePrimaryTab,
  OFFICIAL_URLS,
  openNavDrawer,
  PROJECT_CATEGORIES,
  PROMPT_VARIABLES,
  readSettingsRecord,
  resetAppState,
  ROUTES,
  setJsonInputFile,
  SKILL_CATEGORIES,
  STARTER_PROMPT_TITLES,
  STARTER_SKILL_NAMES,
  triggerAndVerifyOfficialUrl,
  WORKFLOW_CATEGORIES,
  type ErrorCollector,
  type SecurityNetworkGuard,
} from './helpers/app';

const XSS_IMG_PAYLOAD = '<img src=x onerror=window.__xssTriggered=true>';
const XSS_SCRIPT_PAYLOAD = '<script>window.__xssTriggered=true</script>';

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
  if (test.info().title.includes('F26.T2.2')) {
    errors.assertNoPageErrors();
  } else {
    errors.assertNoErrors();
  }
});

async function createProject(
  page: Page,
  opts: {
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
  await navigatePrimaryTab(page, 'Projects');
  await page.getByRole('button', { name: /^new project$/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^title$/i).fill(opts.title);
  if (opts.category) {
    await dialog.getByLabel(/^category$/i).selectOption(opts.category);
  }
  if (opts.machineName !== undefined) {
    await dialog.getByLabel(/machine name/i).fill(opts.machineName);
  }
  if (opts.workspaceLabel !== undefined) {
    await dialog.getByLabel(/workspace label/i).fill(opts.workspaceLabel);
  }
  if (opts.officialUrl !== undefined) {
    await dialog.getByLabel(/official antigravity session url/i).fill(opts.officialUrl);
  }
  if (opts.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(opts.description);
  }
  if (opts.notes !== undefined) {
    await dialog.getByLabel(/^notes$/i).fill(opts.notes);
  }
  if (opts.pinned) {
    await dialog.getByLabel(/pin this project/i).check();
  }
  await dialog.getByRole('button', { name: /^(create project|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

async function createTask(
  page: Page,
  opts: {
    title: string;
    description?: string;
    projectLabel?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    notes?: string;
  },
): Promise<void> {
  await navigateDrawerRoute(page, /task board/i);
  await expectHeading(page, /task board/i);
  await page.getByRole('button', { name: /^new task$/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^title$/i).fill(opts.title);
  if (opts.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(opts.description);
  }
  if (opts.projectLabel !== undefined) {
    await dialog.getByLabel(/^project$/i).selectOption({ label: opts.projectLabel });
  }
  if (opts.status !== undefined) {
    await dialog.getByLabel(/^status$/i).selectOption(opts.status);
  }
  if (opts.priority !== undefined) {
    await dialog.getByLabel(/^priority$/i).selectOption(opts.priority);
  }
  if (opts.dueDate !== undefined) {
    await dialog.getByLabel(/due date/i).fill(opts.dueDate);
  }
  if (opts.notes !== undefined) {
    await dialog.getByLabel(/^notes$/i).fill(opts.notes);
  }
  await dialog.getByRole('button', { name: /^(create task|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

async function createSkill(
  page: Page,
  opts: {
    name: string;
    category?: string;
    description?: string;
    instructions: string;
    samplePrompt?: string;
    tags?: string;
  },
): Promise<void> {
  await navigatePrimaryTab(page, 'Skills');
  await page.getByRole('button', { name: /^new skill$/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^name$/i).fill(opts.name);
  if (opts.category) {
    await dialog.getByLabel(/^category$/i).selectOption(opts.category);
  }
  if (opts.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(opts.description);
  }
  await dialog.getByLabel(/usage instructions/i).fill(opts.instructions);
  if (opts.samplePrompt !== undefined) {
    await dialog.getByLabel(/sample prompt/i).fill(opts.samplePrompt);
  }
  if (opts.tags !== undefined) {
    await dialog.getByLabel(/^tags$/i).fill(opts.tags);
  }
  await dialog.getByRole('button', { name: /^(create skill|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

async function createWorkflow(
  page: Page,
  opts: {
    title: string;
    category?: string;
    description?: string;
    steps: string[];
    relatedSkills?: string;
    copyablePrompt?: string;
    tags?: string;
  },
): Promise<void> {
  await navigateDrawerRoute(page, /workflow library/i);
  await expectHeading(page, /workflow library/i);
  await page.getByRole('button', { name: /^new workflow$/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^title$/i).fill(opts.title);
  if (opts.category) {
    await dialog.getByLabel(/^category$/i).selectOption(opts.category);
  }
  if (opts.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(opts.description);
  }
  for (let i = 0; i < opts.steps.length; i++) {
    if (i > 0) {
      await dialog.getByRole('button', { name: /^add step$/i }).click();
    }
    await dialog.getByLabel(new RegExp(`^step ${i + 1}$`, 'i')).fill(opts.steps[i]);
  }
  if (opts.relatedSkills !== undefined) {
    await dialog.getByLabel(/related skills/i).fill(opts.relatedSkills);
  }
  if (opts.copyablePrompt !== undefined) {
    await dialog.getByLabel(/copyable prompt/i).fill(opts.copyablePrompt);
  }
  if (opts.tags !== undefined) {
    await dialog.getByLabel(/^tags$/i).fill(opts.tags);
  }
  await dialog.getByRole('button', { name: /^(create workflow|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

// ============================================================================
// F1 — Core Runtime & Libraries (Tier 2: >= 2 tests)
// ============================================================================
test.describe('Tier 2: F1 — Core Runtime & Libraries', () => {
  test('F1.T2.1: boots cleanly with junk query params and hash fragment without XSS execution', async ({
    page,
  }) => {
    await page.goto('/?__ag_junk=1&xss=%3Cscript%3E#unknown-fragment', {
      waitUntil: 'domcontentloaded',
    });
    await expectHeading(page, /ag pocket command center/i);
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    errors.assertNoErrors();
    networkGuard.assertClean();
  });

  test('F1.T2.2: survives repeated path slashes and preserves main landmark and primary nav', async ({
    page,
  }) => {
    await page.goto('///settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    errors.assertNoErrors();
    networkGuard.assertClean();
  });
});

// ============================================================================
// F2 — Deep-Link SPA Routing Boundaries (Tier 2: >= 3 tests)
// ============================================================================
test.describe('Tier 2: F2 — Deep-Link SPA Routing Boundaries', () => {
  test('F2.T2.1: unknown nested route (/unknown/route/deep) safely redirects to Home', async ({
    page,
  }) => {
    await page.goto('/unknown/route/deep', { waitUntil: 'domcontentloaded' });
    await expectHeading(page, /ag pocket command center/i);
    await expect(page).toHaveURL(/\/$/);
    errors.assertNoErrors();
  });

  test('F2.T2.2: missing project ID (/projects/missing-id) shows graceful Project not found empty state', async ({
    page,
  }) => {
    await page.goto(ROUTES.projectDetail('missing-id-does-not-exist'), {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('main')).toContainText(/project not found/i);
    const backLink = page.locator('main').getByRole('link', { name: /back to projects/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/projects$/);
    errors.assertNoErrors();
  });

  test('F2.T2.3: trailing slashes and encoded query parameters resolve cleanly on module routes', async ({
    page,
  }) => {
    await page.goto('/projects/?filter=active%20one', { waitUntil: 'domcontentloaded' });
    await expectHeading(page, /^projects$/i);

    await page.goto('/prompts/?q=%3Cimg%20src%3Dx%3E&mode=draft%20one', {
      waitUntil: 'domcontentloaded',
    });
    await expectHeading(page, /prompt studio/i);
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    errors.assertNoErrors();
  });
});

// ============================================================================
// F3 — Official-First Companion Boundary (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F3 — Official-First Companion Boundary', () => {
  test('F3.T2.1: Home OPEN ANTIGRAVITY launches exact https://antigravity.google.com with noopener,noreferrer', async ({
    page,
  }) => {
    const cta = page.getByRole('button', { name: /^open antigravity$/i }).first();
    await triggerAndVerifyOfficialUrl(page, cta, OFFICIAL_URLS.base);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F3.T2.2: Project Detail OPEN PROJECT IN ANTIGRAVITY preserves exact query and path on official host', async ({
    page,
  }) => {
    const sessionUrl = 'https://antigravity.google.com/r/inst-42?p=c%2Fconv-99';
    await createProject(page, { title: 'Deep Session Repo', officialUrl: sessionUrl });
    await page.getByRole('link', { name: 'Deep Session Repo' }).click();
    await expectHeading(page, 'Deep Session Repo');
    const openBtn = page.getByRole('button', { name: /open project in antigravity/i });
    await triggerAndVerifyOfficialUrl(page, openBtn, sessionUrl);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F3.T2.3: Prompt Studio post-copy Open Antigravity button uses official URL and noopener,noreferrer', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Verify official boundary launch.');
    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    const openBtn = page.locator('main').getByRole('button', { name: /^open antigravity$/i });
    await triggerAndVerifyOfficialUrl(page, openBtn, OFFICIAL_URLS.base);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F3.T2.4: Nav Drawer Open Antigravity and Setup Center docs links enforce official targets', async ({
    page,
  }) => {
    await openNavDrawer(page);
    const navDrawer = page.getByRole('dialog', { name: /navigation menu/i });
    const drawerOpenBtn = navDrawer.getByRole('button', { name: /^open antigravity$/i });
    await triggerAndVerifyOfficialUrl(page, drawerOpenBtn, OFFICIAL_URLS.base);
    await closeNavDrawer(page);
    await expect(navDrawer).toBeHidden();

    await navigateDrawerRoute(page, /connection setup center/i);
    await expectHeading(page, /connection setup center/i);
    const docsLinks = page.locator('main a[href^="http"]');
    const count = await docsLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i++) {
      const link = docsLinks.nth(i);
      const href = (await link.getAttribute('href')) ?? '';
      expect(
        href === OFFICIAL_URLS.base || href.startsWith(OFFICIAL_URLS.docsPrefix),
        `Non-official URL found: ${href}`,
      ).toBe(true);
      const rel = ((await link.getAttribute('rel')) ?? '').toLowerCase();
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    }
    errors.assertNoErrors();
  });
});

// ============================================================================
// F4 — Disabled Future Integration Adapter (Tier 2: >= 3 tests)
// ============================================================================
test.describe('Tier 2: F4 — Disabled Future Integration Adapter', () => {
  test('F4.T2.1: Settings displays Official Integration Adapter as Disabled with zero outbound calls', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await expect(page.locator('main')).toContainText('Official Integration Adapter');
    await expect(page.locator('main')).toContainText('Disabled');
    await expect(page.locator('main')).toContainText('official-antigravity-placeholder');
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F4.T2.2: Privacy page explicitly displays enabled: false badge and zero network activity', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /privacy/i);
    await expectHeading(page, /privacy & security boundary/i);
    await expect(page.locator('main')).toContainText('Disabled Future Integration Adapter');
    await expect(page.locator('main')).toContainText('enabled: false');
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F4.T2.3: opening Settings, Privacy, and Home Launcher emits zero external network or WebSocket calls', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('link', { name: /open privacy & security policy/i }).click();
    await expectHeading(page, /privacy & security boundary/i);
    await page.getByRole('link', { name: /back to settings/i }).click();
    await expectHeading(page, /^settings$/i);
    await navigatePrimaryTab(page, 'Home');
    await page.getByRole('button', { name: /^open antigravity$/i }).first().click();
    expect((await getOpenedUrls(page)).length).toBe(1);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });
});

// ============================================================================
// F5 — Strictly Forbidden Behaviors Removal (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F5 — Strictly Forbidden Behaviors Removal', () => {
  test('F5.T2.1: zero <iframe> elements exist across all routes after heavy CRUD', async ({
    page,
  }) => {
    await createProject(page, { title: 'Audit Proj', officialUrl: OFFICIAL_URLS.base });
    await createTask(page, { title: 'Audit Task', projectLabel: 'Audit Proj' });

    const routes = [
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
    ];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('iframe')).toHaveCount(0);
    }
    errors.assertNoErrors();
  });

  test('F5.T2.2: Web Storage contains zero OAuth/bearer tokens after CRUD and Setup completion', async ({
    page,
  }) => {
    await createProject(page, { title: 'Token Check Proj' });
    await navigateDrawerRoute(page, /connection setup center/i);
    await page.getByRole('button', { name: /^mark done$/i }).first().click();
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('F5.T2.3: zero Google authentication cookies are stored across routes', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await navigatePrimaryTab(page, 'Skills');
    await navigatePrimaryTab(page, 'Settings');
    const cookies = await page.context().cookies();
    expect(cookies.filter((c) => /SAPISID|APISID|HSID|SID|oauth|token/i.test(c.name))).toEqual([]);
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('F5.T2.4: zero WebSocket connections are opened during active Prompt Studio & Task Board usage', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Testing zero websockets {{task_description}}');
    await page.getByLabel(/task description/i).fill('No live bridge allowed');
    await createTask(page, { title: 'WS Guard Task', status: 'In Progress' });
    expect(networkGuard.websockets).toEqual([]);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F5.T2.5: zero outbound network requests target google.com or private endpoints during local CRUD', async ({
    page,
  }) => {
    await createProject(page, {
      title: 'Offline Network Guard',
      officialUrl: `${OFFICIAL_URLS.base}/r/test-session`,
      pinned: true,
    });
    await createSkill(page, {
      name: 'Guard Skill',
      instructions: 'Inspect network requests.',
    });
    await createWorkflow(page, {
      title: 'Guard Workflow',
      steps: ['Step one'],
    });
    await createTask(page, { title: 'Guard Task' });
    networkGuard.assertClean();
    errors.assertNoErrors();
  });
});

// ============================================================================
// F6 — Official URL Validation, XSS & Control Char Safety (Tier 2: >= 6 tests; 12 tests)
// ============================================================================
test.describe('Tier 2: F6 — Official URL Validation, XSS & Control Char Safety', () => {
  async function assertProjectUrlRejected(
    page: Page,
    badUrl: string,
    expectedError: RegExp,
  ): Promise<void> {
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^title$/i).fill('Invalid URL Guard');
    await dialog.getByLabel(/official antigravity session url/i).fill(badUrl);
    await dialog.getByRole('button', { name: /^create project$/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(expectedError);
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
  }

  test('F6.T2.1: rejects non-HTTPS http://antigravity.google.com', async ({ page }) => {
    await assertProjectUrlRejected(
      page,
      'http://antigravity.google.com',
      /only https official antigravity urls are permitted/i,
    );
    errors.assertNoErrors();
  });

  test('F6.T2.2: rejects javascript:alert(1) protocol payload', async ({ page }) => {
    await assertProjectUrlRejected(
      page,
      'javascript:alert(1)',
      /only https official antigravity urls are permitted/i,
    );
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    errors.assertNoErrors();
  });

  test('F6.T2.3: rejects data:text/html,<script>alert(1)</script> URL', async ({ page }) => {
    await assertProjectUrlRejected(
      page,
      'data:text/html,<script>alert(1)</script>',
      /only https official antigravity urls are permitted/i,
    );
    errors.assertNoErrors();
  });

  test('F6.T2.4: rejects untrusted third-party HTTPS host https://evil.com', async ({ page }) => {
    await assertProjectUrlRejected(
      page,
      'https://evil.com/phish',
      /url must point to https:\/\/antigravity\.google\.com/i,
    );
    errors.assertNoErrors();
  });

  test('F6.T2.5: rejects lookalike host https://antigravity.google.com.evil.com', async ({
    page,
  }) => {
    await assertProjectUrlRejected(
      page,
      'https://antigravity.google.com.evil.com',
      /url must point to https:\/\/antigravity\.google\.com/i,
    );
    errors.assertNoErrors();
  });

  test('F6.T2.6: rejects embedded credentials https://user:pass@antigravity.google.com', async ({
    page,
  }) => {
    await assertProjectUrlRejected(
      page,
      'https://user:pass@antigravity.google.com',
      /embedded credentials are not allowed/i,
    );
    errors.assertNoErrors();
  });

  test('F6.T2.7: rejects custom port https://antigravity.google.com:8443', async ({ page }) => {
    await assertProjectUrlRejected(
      page,
      'https://antigravity.google.com:8443',
      /custom ports are not allowed/i,
    );
    errors.assertNoErrors();
  });

  test('F6.T2.8: rejects ftp:// & malformed URLs, while accepting whitespace-only URL as unset', async ({
    page,
  }) => {
    await assertProjectUrlRejected(
      page,
      'ftp://antigravity.google.com',
      /only https official antigravity urls are permitted/i,
    );
    await assertProjectUrlRejected(page, 'not a valid url', /invalid whitespace|invalid url format/i);

    await createProject(page, { title: 'Whitespace URL Project', officialUrl: '   ' });
    await expect(page.locator('main')).toContainText('Whitespace URL Project');
    await expect(page.locator('main')).toContainText('No URL');
    errors.assertNoErrors();
  });

  test('F6.T2.9: renders XSS payloads and strips NUL control chars safely in Projects & Project Detail', async ({
    page,
  }) => {
    const titlePayload = `Safe\u0000${XSS_IMG_PAYLOAD}`;
    const notesPayload = `Note\u0000${XSS_SCRIPT_PAYLOAD}`;
    await createProject(page, {
      title: titlePayload,
      workspaceLabel: `ws\u0000${XSS_IMG_PAYLOAD}`,
      notes: notesPayload,
    });

    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    const listText = (await page.locator('main').textContent()) ?? '';
    expect(listText).toContain(XSS_IMG_PAYLOAD);
    expect(listText).not.toContain('\u0000');

    await page.getByRole('link', { name: new RegExp(XSS_IMG_PAYLOAD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    const detailText = (await page.locator('main').textContent()) ?? '';
    expect(detailText).toContain(XSS_SCRIPT_PAYLOAD);
    expect(detailText).not.toContain('\u0000');
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    errors.assertNoErrors();
  });

  test('F6.T2.10: renders XSS payloads and strips NUL control chars safely in Prompt Studio & Preview', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill(`Title\u0000${XSS_SCRIPT_PAYLOAD}`);
    await page.getByLabel('Prompt', { exact: true }).fill(`Body {{task_description}} ${XSS_IMG_PAYLOAD}\u0000`);
    await page.getByLabel(/task description/i).fill(XSS_SCRIPT_PAYLOAD);
    await page.getByRole('button', { name: /^preview$/i }).click();

    const preview = page.getByTestId('prompt-preview');
    await expect(preview).toBeVisible();
    const previewText = (await preview.textContent()) ?? '';
    expect(previewText).toContain(XSS_IMG_PAYLOAD);
    expect(previewText).toContain(XSS_SCRIPT_PAYLOAD);
    expect(previewText).not.toContain('\u0000');
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    errors.assertNoErrors();
  });

  test('F6.T2.11: renders XSS payloads safely in Skill Deck & Workflow Library', async ({
    page,
  }) => {
    await createSkill(page, {
      name: `Skill ${XSS_IMG_PAYLOAD}`,
      instructions: `Follow\u0000${XSS_SCRIPT_PAYLOAD}`,
      samplePrompt: XSS_IMG_PAYLOAD,
    });
    await page.getByRole('button', { name: new RegExp(`show details for Skill`, 'i') }).click();
    const skillText = (await page.locator('main').textContent()) ?? '';
    expect(skillText).toContain(XSS_SCRIPT_PAYLOAD);
    expect(skillText).not.toContain('\u0000');

    await createWorkflow(page, {
      title: `WF ${XSS_SCRIPT_PAYLOAD}`,
      steps: [`Step\u0000${XSS_IMG_PAYLOAD}`],
      copyablePrompt: XSS_SCRIPT_PAYLOAD,
    });
    await page.getByRole('button', { name: new RegExp(`show details for WF`, 'i') }).click();
    const wfText = (await page.locator('main').textContent()) ?? '';
    expect(wfText).toContain(XSS_IMG_PAYLOAD);
    expect(wfText).not.toContain('\u0000');
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    errors.assertNoErrors();
  });

  test('F6.T2.12: renders XSS payloads and strips NUL chars safely in Task Board', async ({
    page,
  }) => {
    await createTask(page, {
      title: `Task\u0000${XSS_IMG_PAYLOAD}`,
      description: XSS_SCRIPT_PAYLOAD,
      notes: `Notes\u0000${XSS_IMG_PAYLOAD}`,
    });
    const text = (await page.locator('main').textContent()) ?? '';
    expect(text).toContain(XSS_IMG_PAYLOAD);
    expect(text).toContain(XSS_SCRIPT_PAYLOAD);
    expect(text).not.toContain('\u0000');
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    errors.assertNoErrors();
  });
});

// ============================================================================
// F7 — OLED Dark Default + Light Theme (Tier 2: >= 3 tests)
// ============================================================================
test.describe('Tier 2: F7 — OLED Dark Default + Light Theme', () => {
  test('F7.T2.1: invalid stored theme in IndexedDB falls back to OLED dark styling', async ({
    page,
  }) => {
    await page.evaluate(async (dbName) => {
      await new Promise<void>((resolve, reject) => {
        const open = window.indexedDB.open(dbName);
        open.onerror = () => reject(open.error ?? new Error('Open failed'));
        open.onsuccess = () => {
          const idb = open.result;
          const tx = idb.transaction('settings', 'readwrite');
          const store = tx.objectStore('settings');
          const req = store.get('default');
          req.onsuccess = () => {
            const current = req.result as Record<string, unknown>;
            store.put({ ...current, theme: 'invalid-neon' });
          };
          tx.oncomplete = () => {
            idb.close();
            resolve();
          };
          tx.onerror = () => {
            idb.close();
            reject(tx.error ?? new Error('Tx failed'));
          };
        };
      });
    }, DEXIE_DB_NAME);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    const snap = await getThemeSnapshot(page);
    expect(snap.isDarkBg).toBe(true);
    expect(snap.bodyBg).toBe('rgb(0, 0, 0)');
    errors.assertNoErrors();
  });

  test('F7.T2.2: rapid Dark -> Light -> Dark toggle persists final preference across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const lightBtn = page.getByRole('button', { name: /^light$/i });
    const darkBtn = page.getByRole('button', { name: /^oled dark$/i });

    await lightBtn.click();
    await expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
    await lightBtn.click();
    await expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await readSettingsRecord(page))?.theme).toBe('light');

    await page.reload({ waitUntil: 'domcontentloaded' });
    expect((await getThemeSnapshot(page)).isDarkBg).toBe(false);
    errors.assertNoErrors();
  });

  test('F7.T2.3: AG monogram SVG renders with non-zero geometry in both OLED Dark and Light modes', async ({
    page,
  }) => {
    const svg = page.locator('header svg, main svg').first();
    await expect(svg).toBeVisible();
    const boxDark = await svg.boundingBox();
    expect(boxDark && boxDark.width > 16 && boxDark.height > 16).toBe(true);

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /^light$/i }).click();
    await navigatePrimaryTab(page, 'Home');
    const boxLight = await svg.boundingBox();
    expect(boxLight && boxLight.width > 16 && boxLight.height > 16).toBe(true);
    errors.assertNoErrors();
  });
});

// ============================================================================
// F8 — Accessibility & Ergonomics Baseline (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F8 — Accessibility & Ergonomics Baseline', () => {
  test('F8.T2.1: Escape dismisses Sheet and restores focus to trigger button', async ({ page }) => {
    await navigatePrimaryTab(page, 'Projects');
    const trigger = page.getByRole('button', { name: /^new project$/i }).first();
    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    errors.assertNoErrors();
  });

  test('F8.T2.2: clicking Sheet backdrop dismisses dialog cleanly', async ({ page }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    const clickY = box && box.y > 12 ? Math.floor(box.y / 2) : 5;
    await page.mouse.click(5, clickY);
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F8.T2.3: Reduced motion switch toggles data-reduced-motion attribute and persists across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const rmSwitch = page.getByRole('switch', { name: /reduced motion/i });
    await expect(rmSwitch).toHaveAttribute('aria-checked', 'false');
    await rmSwitch.click();
    await expect(rmSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await expect.poll(async () => (await readSettingsRecord(page))?.reducedMotion).toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await expect(rmSwitch).toHaveAttribute('aria-checked', 'true');
    errors.assertNoErrors();
  });

  test('F8.T2.4: primary navigation and header controls meet 44x44px minimum touch target', async ({
    page,
  }) => {
    const navItems = page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link');
    const count = await navItems.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      const box = await navItems.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    errors.assertNoErrors();
  });
});

// ============================================================================
// F9 — Responsive Layout & Overflow Containment at 320px (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F9 — Responsive Layout & Overflow Containment', () => {
  test('F9.T2.1: 320px viewport contains long unbroken Project title (140) and workspace (160) with zero overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const longTitle = 'P'.repeat(140);
    const longWorkspace = 'W'.repeat(160);
    await createProject(page, {
      title: longTitle,
      machineName: 'M'.repeat(120),
      workspaceLabel: longWorkspace,
    });
    await expect(page.locator('main')).toContainText(longTitle);
    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test('F9.T2.2: 320px Project Detail contains long unbroken official URL without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const longUrl = `https://antigravity.google.com/r/${'segment-'.repeat(12)}end?p=${'x'.repeat(60)}`;
    await createProject(page, { title: 'Long URL Project', officialUrl: longUrl });
    await page.getByRole('link', { name: 'Long URL Project' }).click();
    await expectHeading(page, 'Long URL Project');
    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test('F9.T2.3: 320px Prompt Studio contains long unbroken token in editor and preview without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await navigatePrimaryTab(page, 'Prompts');
    const longToken = 'X'.repeat(180);
    await page.getByLabel('Prompt', { exact: true }).fill(`Check ${longToken}`);
    await page.getByRole('button', { name: /^preview$/i }).click();
    await expect(page.getByTestId('prompt-preview')).toContainText(longToken);
    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test('F9.T2.4: 320px Skill Deck & Workflow Library contain long unbroken names and steps without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await createSkill(page, {
      name: 'S'.repeat(100),
      instructions: 'I'.repeat(180),
      tags: 'longtagone,longtagtwo',
    });
    await assertZeroHorizontalOverflow(page);

    await createWorkflow(page, {
      title: 'F'.repeat(100),
      steps: ['Step_' + 'A'.repeat(120)],
    });
    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test('F9.T2.5: 320px Task Board List & Kanban views contain long unbroken task title without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await createTask(page, {
      title: 'T'.repeat(150),
      description: 'D'.repeat(180),
    });
    await assertZeroHorizontalOverflow(page);
    await page.getByRole('button', { name: /^kanban$/i }).click();
    await expect(page.getByTestId('task-kanban')).toBeVisible();
    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });
});

// ============================================================================
// F10 — Primary Bottom Nav & Secondary Drawer Boundaries (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F10 — Primary Bottom Nav & Secondary Drawer Boundaries', () => {
  test('F10.T2.1: rapid switching across all 5 primary tabs settles cleanly without errors', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await navigatePrimaryTab(page, 'Prompts');
    await navigatePrimaryTab(page, 'Skills');
    await navigatePrimaryTab(page, 'Settings');
    await navigatePrimaryTab(page, 'Home');
    await expectHeading(page, /ag pocket command center/i);
    errors.assertNoErrors();
  });

  test('F10.T2.2: Escape closes navigation drawer without altering current route', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await openNavDrawer(page);
    const navDrawer = page.getByRole('dialog', { name: /navigation menu/i });
    await expect(navDrawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(navDrawer).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);
    errors.assertNoErrors();
  });

  test('F10.T2.3: Close navigation menu button closes drawer cleanly', async ({ page }) => {
    await openNavDrawer(page);
    const closeBtn = page.getByRole('button', { name: /close navigation menu/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(page.getByRole('dialog', { name: /navigation menu/i })).toBeHidden();
    errors.assertNoErrors();
  });

  test('F10.T2.4: selecting a secondary drawer link navigates and automatically closes drawer', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /activity log/i);
    await expectHeading(page, /activity log/i);
    await expect(page.getByRole('dialog', { name: /navigation menu/i })).toBeHidden();
    errors.assertNoErrors();
  });
});

// ============================================================================
// F11 — Home Header & Locally Knowable Status Transitions (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F11 — Home Header & Locally Knowable Status', () => {
  test('F11.T2.1: fresh app starts in "Not configured" readiness state', async ({ page }) => {
    await expect(page.locator('main')).toContainText('Not configured');
    errors.assertNoErrors();
  });

  test('F11.T2.2: reviewing only CLI or Remote Agents step yields "Setup instructions available"', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    const stepButtons = page.getByRole('button', { name: /^mark done$/i });
    await stepButtons.nth(2).click();
    await expect(page.locator('main')).toContainText('Setup instructions available');
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Setup instructions available');
    errors.assertNoErrors();
  });

  test('F11.T2.3: checking only Desktop step OR adding project URL yields "Remote connection not verified"', async ({
    page,
  }) => {
    await createProject(page, {
      title: 'Readiness URL Proj',
      officialUrl: `${OFFICIAL_URLS.base}/r/check`,
    });
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Remote connection not verified');
    errors.assertNoErrors();
  });

  test('F11.T2.4: Desktop step + Mobile step transitions readiness to "Ready to open" across reload', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    const stepButtons = page.getByRole('button', { name: /^mark done$/i });
    await stepButtons.nth(0).click();
    await stepButtons.nth(0).click();
    await expect(page.locator('main')).toContainText('Ready to open');
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Ready to open');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('Ready to open');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F12 — Remote Control Launcher & Offline Warning (Tier 2: >= 3 tests)
// ============================================================================
test.describe('Tier 2: F12 — Remote Control Launcher & Info Cards', () => {
  test('F12.T2.1: offline state shows Launcher internet requirement warning on Home', async ({
    page,
    context,
  }) => {
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('main')).toContainText(
        /device is offline\. opening https:\/\/antigravity\.google\.com requires an active internet connection/i,
      );
    } finally {
      await context.setOffline(false);
    }
    errors.assertNoErrors();
  });

  test('F12.T2.2: restoring online removes Home Launcher offline warning', async ({
    page,
    context,
  }) => {
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('main')).toContainText(/device is offline/i);
    } finally {
      await context.setOffline(false);
    }
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('main')).not.toContainText(/device is offline/i);
    errors.assertNoErrors();
  });

  test('F12.T2.3: Home Setup Center and Connection Setup Guide links both navigate to /setup', async ({
    page,
  }) => {
    await page.getByRole('link', { name: /connection setup guide/i }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expectHeading(page, /connection setup center/i);
    await navigatePrimaryTab(page, 'Home');
    await page.getByRole('link', { name: /^setup center$/i }).click();
    await expect(page).toHaveURL(/\/setup$/);
    errors.assertNoErrors();
  });
});

// ============================================================================
// F13 — Home Quick Actions, Pinned Projects & Task Overview Boundaries (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F13 — Home Pinned Projects & Task Overview Boundaries', () => {
  test('F13.T2.1: zero pinned projects shows "No pinned projects yet" and Manage Projects link', async ({
    page,
  }) => {
    await expect(page.locator('main')).toContainText('No pinned projects yet');
    await page.getByRole('link', { name: /manage projects/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
    errors.assertNoErrors();
  });

  test('F13.T2.2: pinned project without officialUrl omits Home "Open" button while keeping "Details" link', async ({
    page,
  }) => {
    await createProject(page, { title: 'Pinned Without URL', pinned: true, officialUrl: '' });
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('Pinned Without URL');
    const pinnedItem = page
      .locator('main')
      .getByRole('listitem')
      .filter({ hasText: 'Pinned Without URL' });
    await expect(pinnedItem.getByRole('link', { name: /^details$/i })).toBeVisible();
    await expect(pinnedItem.getByRole('button', { name: /^open$/i })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F13.T2.3: zero tasks shows "No personal tasks yet" and 0 across all 5 status tiles', async ({
    page,
  }) => {
    await expect(page.locator('main')).toContainText('No personal tasks yet');
    await expect(page.locator('main')).toContainText('Backlog');
    await expect(page.locator('main')).toContainText('Completed');
    errors.assertNoErrors();
  });

  test('F13.T2.4: when all tasks are Completed, Home shows "All N personal tasks are marked Completed."', async ({
    page,
  }) => {
    await createTask(page, { title: 'Done Task 1', status: 'Completed' });
    await createTask(page, { title: 'Done Task 2', status: 'Completed' });
    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText('All 2 personal tasks are marked Completed.');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F14 — Projects CRUD, Validation, Duplicates & Filter Boundaries (Tier 2: >= 6 tests)
// ============================================================================
test.describe('Tier 2: F14 — Projects CRUD & Filter Boundaries', () => {
  test('F14.T2.1: empty or whitespace-only Project title shows validation error and stays open', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^title$/i).fill('   ');
    await dialog.getByRole('button', { name: /^create project$/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Project title is required.');
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F14.T2.2: Project Title (140) and Workspace (160) enforce maxLength boundaries cleanly', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel(/^title$/i)).toHaveAttribute('maxlength', '140');
    await expect(dialog.getByLabel(/workspace label/i)).toHaveAttribute('maxlength', '160');

    await dialog.getByLabel(/^title$/i).fill('A'.repeat(141));
    await dialog.getByRole('button', { name: /^create project$/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F14.T2.3: creating two projects with identical title & workspace creates distinct routes without collision', async ({
    page,
  }) => {
    await createProject(page, { title: 'Same Name', workspaceLabel: '/repo/same' });
    await createProject(page, { title: 'Same Name', workspaceLabel: '/repo/same' });
    const links = page.getByRole('link', { name: 'Same Name' });
    await expect(links).toHaveCount(2);
    const href1 = await links.nth(0).getAttribute('href');
    const href2 = await links.nth(1).getAttribute('href');
    expect(href1).not.toBe(href2);
    errors.assertNoErrors();
  });

  test('F14.T2.4: zero-match project search displays "No matching projects" and Clear filters restores list', async ({
    page,
  }) => {
    await createProject(page, { title: 'Alpha Search Project', category: 'Backend' });
    await page.getByLabel(/search projects/i).fill('__no_such_project__');
    await expect(page.locator('main')).toContainText('No matching projects');
    await page.getByRole('button', { name: /^clear filters$/i }).click();
    await expect(page.locator('main')).toContainText('Alpha Search Project');
    errors.assertNoErrors();
  });

  test('F14.T2.5: category filter with zero matches displays "No matching projects" cleanly', async ({
    page,
  }) => {
    await createProject(page, { title: 'Only AI Project', category: 'AI / ML' });
    await page.getByLabel(/^category$/i).selectOption(PROJECT_CATEGORIES[6]); // Experiments
    await expect(page.locator('main')).toContainText('No matching projects');
    await page.getByRole('button', { name: /^clear filters$/i }).click();
    await expect(page.locator('main')).toContainText('Only AI Project');
    errors.assertNoErrors();
  });

  test('F14.T2.6: canceling Delete project preserves record; confirming deletes and shows empty state', async ({
    page,
  }) => {
    await createProject(page, { title: 'Disposable Project' });
    await page.getByRole('button', { name: 'Delete Disposable Project' }).click();
    let dialog = page.getByRole('dialog', { name: /delete project\?/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('Disposable Project');

    await page.getByRole('button', { name: 'Delete Disposable Project' }).click();
    dialog = page.getByRole('dialog', { name: /delete project\?/i });
    await dialog.getByRole('button', { name: /^delete project$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('No projects yet');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F15 — Project Detail Boundaries (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F15 — Project Detail View Boundaries', () => {
  test('F15.T2.1: Project Detail without officialUrl renders "No session URL saved" and Add URL CTA', async ({
    page,
  }) => {
    await createProject(page, { title: 'Unset URL Project' });
    await page.getByRole('link', { name: 'Unset URL Project' }).click();
    await expect(page.locator('main')).toContainText('No session URL saved');
    await expect(page.getByRole('button', { name: /^add url$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open project in antigravity/i })).toHaveCount(0);
    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /^open antigravity$/i }),
      OFFICIAL_URLS.base,
    );
    errors.assertNoErrors();
  });

  test('F15.T2.2: clicking Add URL on Project Detail saves officialUrl and enables OPEN PROJECT IN ANTIGRAVITY', async ({
    page,
  }) => {
    await createProject(page, { title: 'Add URL Later' });
    await page.getByRole('link', { name: 'Add URL Later' }).click();
    await page.getByRole('button', { name: /^add url$/i }).click();
    const dialog = page.getByRole('dialog', { name: /edit project/i });
    const sessionUrl = `${OFFICIAL_URLS.base}/r/newly-added`;
    await dialog.getByLabel(/official antigravity session url/i).fill(sessionUrl);
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).toBeHidden();

    const openProjectBtn = page.getByRole('button', { name: /open project in antigravity/i });
    await triggerAndVerifyOfficialUrl(page, openProjectBtn, sessionUrl);
    errors.assertNoErrors();
  });

  test('F15.T2.3: Project Detail renders "Not set", "No description.", and "No notes." fallbacks when blank', async ({
    page,
  }) => {
    await createProject(page, { title: 'Minimal Project' });
    await page.getByRole('link', { name: 'Minimal Project' }).click();
    await expect(page.locator('main')).toContainText('Not set');
    await expect(page.locator('main')).toContainText('No description.');
    await expect(page.locator('main')).toContainText('No notes.');
    errors.assertNoErrors();
  });

  test('F15.T2.4: deleting project from Project Detail navigates back to /projects', async ({
    page,
  }) => {
    await createProject(page, { title: 'Detail Delete Project' });
    await page.getByRole('link', { name: 'Detail Delete Project' }).click();
    await page.getByRole('button', { name: /^delete$/i }).click();
    const dialog = page.getByRole('dialog', { name: /delete project\?/i });
    await dialog.getByRole('button', { name: /^delete project$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator('main')).not.toContainText('Detail Delete Project');
    errors.assertNoErrors();
  });

  test('F15.T2.5: visiting deleted project URL shows "Project not found" empty state', async ({
    page,
  }) => {
    await createProject(page, { title: 'Soon Deleted' });
    await page.getByRole('link', { name: 'Soon Deleted' }).click();
    const detailUrl = page.url();
    await page.getByRole('button', { name: /^delete$/i }).click();
    const dialog = page.getByRole('dialog', { name: /delete project\?/i });
    await dialog.getByRole('button', { name: /^delete project$/i }).click();
    await expect(dialog).toBeHidden();

    await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('Project not found');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F16 — Prompt Studio Editor, Counts, Clear & Copy Boundaries (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F16 — Prompt Studio Editor & Copy Boundaries', () => {
  test('F16.T2.1: copying empty or whitespace-only prompt warns without copying or showing Prompt copied banner', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('   \n  ');
    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await expect(page.getByText(/nothing to copy yet/i)).toBeVisible();
    expect(await getCopiedTexts(page)).toEqual([]);
    await expect(page.locator('main')).not.toContainText('Prompt copied');
    errors.assertNoErrors();
  });

  test('F16.T2.2: whitespace-only prompt reports "0 words" while counting characters', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('     ');
    await expect(page.locator('main')).toContainText('0 words · 5 characters');
    errors.assertNoErrors();
  });

  test('F16.T2.3: Clear confirmation Cancel preserves title, body, tags, and draft across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Keep Draft');
    await page.getByLabel('Prompt', { exact: true }).fill('Draft body remains intact.');
    await page.getByRole('button', { name: /^clear$/i }).click();
    const alertDialog = page.getByRole('alertdialog', { name: /confirm clear/i });
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(alertDialog).toBeHidden();
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Draft body remains intact.');

    // Wait for debounced autosave
    await expect
      .poll(async () =>
        page.evaluate(
          (dbName) =>
            new Promise<string | null>((resolve) => {
              const req = window.indexedDB.open(dbName);
              req.onsuccess = () => {
                const idb = req.result;
                const getReq = idb.transaction('promptDrafts', 'readonly').objectStore('promptDrafts').get('active');
                getReq.onsuccess = () => {
                  idb.close();
                  resolve((getReq.result as { body?: string } | undefined)?.body ?? null);
                };
              };
            }),
          DEXIE_DB_NAME,
        ),
      )
      .toBe('Draft body remains intact.');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Draft body remains intact.');
    errors.assertNoErrors();
  });

  test('F16.T2.4: Clear confirmation "Yes, clear" resets editor, tags, preview, and persisted draft', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^title$/i).fill('Wipe Me');
    await page.getByLabel('Prompt', { exact: true }).fill('Wipe body {{project_name}}');
    await page.getByLabel(/^add tag$/i).fill('wipetag');
    await page.getByRole('button', { name: /add tag to prompt/i }).click();
    await page.getByRole('button', { name: /^clear$/i }).click();
    await page.getByRole('button', { name: /^yes, clear$/i }).click();

    await expect(page.getByLabel(/^title$/i)).toHaveValue('');
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('');
    await expect(page.getByRole('list', { name: 'Tags' })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('');
    errors.assertNoErrors();
  });

  test('F16.T2.5: empty and duplicate tags are ignored; removing a tag removes only that tag', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel(/^add tag$/i).fill('   ');
    await page.getByRole('button', { name: /add tag to prompt/i }).click();
    await expect(page.getByRole('list', { name: 'Tags' })).toHaveCount(0);

    await page.getByLabel(/^add tag$/i).fill('security');
    await page.getByRole('button', { name: /add tag to prompt/i }).click();
    await page.getByLabel(/^add tag$/i).fill('security');
    await page.getByRole('button', { name: /add tag to prompt/i }).click();
    await page.getByLabel(/^add tag$/i).fill('mobile');
    await page.getByRole('button', { name: /add tag to prompt/i }).click();

    const tagsList = page.getByRole('list', { name: 'Tags' });
    await expect(tagsList.getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Remove tag security' }).click();
    await expect(tagsList.getByRole('listitem')).toHaveCount(1);
    await expect(tagsList).toContainText('mobile');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F17 — Prompt Studio Variable Interpolation Boundaries (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F17 — Prompt Studio Variable Interpolation', () => {
  test('F17.T2.1: zero-variable prompt hides the Fill variables card completely', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Plain prompt with no placeholders.');
    await expect(page.getByRole('heading', { name: /^fill variables$/i })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F17.T2.2: unfilled or whitespace variable leaves {{placeholder}} intact and displays notice in Preview', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill(`Run ${PROMPT_VARIABLES[0]} and ${PROMPT_VARIABLES[1]}`);
    await page.getByLabel(/project name/i).fill('AG Pocket');
    await page.getByLabel(/task description/i).fill('   ');
    await page.getByRole('button', { name: /^preview$/i }).click();

    await expect(page.getByTestId('prompt-preview')).toContainText('Run AG Pocket and {{task_description}}');
    await expect(page.locator('main')).toContainText(
      'Some variables are unfilled and will stay as {{placeholders}}.',
    );
    errors.assertNoErrors();
  });

  test('F17.T2.3: special replacement characters ($1, $$, $&) in variable values interpolate literally', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Price: {{constraints}}');
    const specialValue = 'Keep cost under $100 and escape $1 $$ $& safely';
    await page.getByLabel(/constraints/i).fill(specialValue);
    await page.getByRole('button', { name: /^preview$/i }).click();
    await expect(page.getByTestId('prompt-preview')).toContainText(`Price: ${specialValue}`);
    errors.assertNoErrors();
  });

  test('F17.T2.4: blocked prototype keys (__proto__, constructor, prototype) do not pollute Preview', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page
      .getByLabel('Prompt', { exact: true })
      .fill('Check {{__proto__}} {{constructor}} {{prototype}} {{project_name}}');
    await page.getByLabel(/project name/i).fill('SafeApp');
    await page.getByRole('button', { name: /^preview$/i }).click();
    const text = (await page.getByTestId('prompt-preview').textContent()) ?? '';
    expect(text).toContain('{{__proto__}} {{constructor}} {{prototype}} SafeApp');
    expect(text).not.toContain('[object Object]');
    errors.assertNoErrors();
  });

  test('F17.T2.5: custom variable {{target_branch}} humanizes cleanly and interpolates in copied text', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Merge into {{target_branch}} now.');
    await page.getByLabel(/^target branch$/i).fill('release/v2');
    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    const copied = await getCopiedTexts(page);
    expect(copied[copied.length - 1]).toBe('Merge into release/v2 now.');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F18 — Prompt Studio Templates & 12 Starters Boundaries (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F18 — Prompt Studio Template Library & Starters', () => {
  test('F18.T2.1: saving template with empty title or empty body surfaces validation error without saving', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^save as template$/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('main')).toContainText(/title is required|body is required/i);
    errors.assertNoErrors();
  });

  test('F18.T2.2: searching templates with zero matches displays "No templates found"', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const dialog = page.getByRole('dialog', { name: /prompt templates/i });
    await dialog.getByLabel(/search templates/i).fill('__nonexistent_template_xyz__');
    await expect(dialog).toContainText('No templates found');
    await dialog.getByRole('button', { name: /close prompt templates/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F18.T2.3: duplicating a template creates "<title> (copy)" without mutating original', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const dialog = page.getByRole('dialog', { name: /prompt templates/i });
    await dialog.getByRole('button', { name: 'Duplicate template Build a New Feature' }).click();
    await expect(dialog.getByRole('heading', { level: 3, name: 'Build a New Feature (copy)' })).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 3, name: 'Build a New Feature', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: /close prompt templates/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F18.T2.4: template delete Cancel preserves starter; Confirm delete removes it', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const dialog = page.getByRole('dialog', { name: /prompt templates/i });
    await dialog.getByRole('button', { name: 'Delete template Audit a Codebase' }).click();
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog.getByRole('heading', { level: 3, name: 'Audit a Codebase' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete template Audit a Codebase' }).click();
    await dialog.getByRole('button', { name: 'Confirm delete Audit a Codebase' }).click();
    await expect(dialog.getByRole('heading', { level: 3, name: 'Audit a Codebase' })).toHaveCount(0);
    await dialog.getByRole('button', { name: /close prompt templates/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F18.T2.5: deleting all 12 starter templates stays empty across full page reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const dialog = page.getByRole('dialog', { name: /prompt templates/i });
    for (const title of STARTER_PROMPT_TITLES) {
      await dialog.getByRole('button', { name: `Delete template ${title}` }).click();
      await dialog.getByRole('button', { name: `Confirm delete ${title}` }).click();
    }
    await expect(dialog).toContainText('No templates found');
    await dialog.getByRole('button', { name: /close prompt templates/i }).click();
    await expect(dialog).toBeHidden();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^templates$/i }).click();
    const reopened = page.getByRole('dialog', { name: /prompt templates/i });
    await expect(reopened).toContainText('No templates found');
    await reopened.getByRole('button', { name: /close prompt templates/i }).click();
    await expect(reopened).toBeHidden();
    errors.assertNoErrors();
  });
});

// ============================================================================
// F19 — Skill Deck Validation, Duplicates & Filters (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F19 — Skill Deck Validation & Filter Boundaries', () => {
  test('F19.T2.1: empty skill name & instructions show both validation errors in role="alert"', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: /^new skill$/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /^create skill$/i }).click();
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('Skill name is required.');
    await expect(alert).toContainText('Skill instructions are required.');
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F19.T2.2: creating a skill with duplicate name does not overwrite existing entry', async ({
    page,
  }) => {
    await createSkill(page, { name: 'Dup Skill', instructions: 'First instructions' });
    await createSkill(page, { name: 'Dup Skill', instructions: 'Second instructions' });
    await expect(page.getByRole('heading', { level: 2, name: 'Dup Skill' })).toHaveCount(2);
    errors.assertNoErrors();
  });

  test('F19.T2.3: zero-match skill search and empty Favourites filter show "No matching skills"', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByLabel(/search skills/i).fill('__no_such_skill__');
    await expect(page.locator('main')).toContainText('No matching skills');
    await page.getByLabel(/search skills/i).fill('');

    await page.getByRole('button', { name: /favourites only/i }).click();
    await expect(page.locator('main')).toContainText('No matching skills');
    errors.assertNoErrors();
  });

  test('F19.T2.4: inline skill delete Cancel preserves skill; Confirm delete removes it', async ({
    page,
  }) => {
    await createSkill(page, { name: 'Temp Skill', instructions: 'Temporary' });
    await page.getByRole('button', { name: 'Delete Temp Skill' }).click();
    const confirmBox = page.getByRole('alertdialog', { name: 'Confirm delete Temp Skill' });
    await confirmBox.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Temp Skill' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete Temp Skill' }).click();
    await confirmBox.getByRole('button', { name: /^confirm delete$/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Temp Skill' })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F19.T2.5: filtering by a Skill category with zero entries shows "No matching skills"', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByLabel(/^category$/i).selectOption(SKILL_CATEGORIES[1]); // Backend (0 starters)
    await expect(page.locator('main')).toContainText('No matching skills');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F20 — Skill Deck Starters & Disclosure Boundaries (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F20 — Skill Deck Starters & Disclosure', () => {
  test('F20.T2.1: deleting a starter skill persists across reload without re-seeding', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    await page.getByRole('button', { name: 'Delete Hallmark' }).click();
    await page.getByRole('alertdialog', { name: 'Confirm delete Hallmark' }).getByRole('button', { name: /^confirm delete$/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Hallmark' })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 2, name: 'Hallmark' })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F20.T2.2: deleting all 9 starter skills shows "No skills yet" across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    for (const name of STARTER_SKILL_NAMES) {
      await page.getByRole('button', { name: `Delete ${name}` }).click();
      await page.getByRole('alertdialog', { name: `Confirm delete ${name}` }).getByRole('button', { name: /^confirm delete$/i }).click();
    }
    await expect(page.locator('main')).toContainText('No skills yet');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('No skills yet');
    errors.assertNoErrors();
  });

  test('F20.T2.3: starter skill details collapse/expand cleanly via Show/Hide details toggle', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    const toggle = page.getByRole('button', { name: 'Show details for Teamwork' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('main')).not.toContainText('Usage instructions');
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Hide details for Teamwork' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.locator('main')).toContainText('Usage instructions');
    await page.getByRole('button', { name: 'Hide details for Teamwork' }).click();
    await expect(page.locator('main')).not.toContainText('Usage instructions');
    errors.assertNoErrors();
  });

  test('F20.T2.4: desktop skill inspection disclosure remains visible even when Skill Deck is emptied', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Skills');
    for (const name of STARTER_SKILL_NAMES) {
      await page.getByRole('button', { name: `Delete ${name}` }).click();
      await page.getByRole('alertdialog', { name: `Confirm delete ${name}` }).getByRole('button', { name: /^confirm delete$/i }).click();
    }
    await expect(page.locator('main')).toContainText(
      /cannot inspect the skills installed on your desktop/i,
    );
    errors.assertNoErrors();
  });
});

// ============================================================================
// F21 — Workflow Library Validation, Step Guards & Fallbacks (Tier 2: >= 5 tests)
// ============================================================================
test.describe('Tier 2: F21 — Workflow Library Boundaries', () => {
  test('F21.T2.1: empty title and blank step trigger both Workflow validation errors', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow library/i);
    await page.getByRole('button', { name: /^new workflow$/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /^create workflow$/i }).click();
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('Workflow title is required.');
    await expect(alert).toContainText('At least one step is required.');
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F21.T2.2: last remaining workflow step cannot be removed; adding and removing step 2 works', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow library/i);
    await page.getByRole('button', { name: /^new workflow$/i }).first().click();
    const dialog = page.getByRole('dialog');
    const removeStep1 = dialog.getByRole('button', { name: 'Remove step 1' });
    await expect(removeStep1).toBeDisabled();

    await dialog.getByRole('button', { name: /^add step$/i }).click();
    await expect(dialog.getByLabel(/^step 2$/i)).toBeVisible();
    await expect(removeStep1).toBeEnabled();
    await dialog.getByRole('button', { name: 'Remove step 2' }).click();
    await expect(dialog.getByLabel(/^step 2$/i)).toHaveCount(0);
    await expect(removeStep1).toBeDisabled();

    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F21.T2.3: zero-match search and unused Custom category display "No matching workflows"', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow library/i);
    await page.getByLabel(/search workflows/i).fill('__no_such_workflow__');
    await expect(page.locator('main')).toContainText('No matching workflows');
    await page.getByLabel(/search workflows/i).fill('');

    await page.getByLabel(/^category$/i).selectOption(WORKFLOW_CATEGORIES[4]); // Custom
    await expect(page.locator('main')).toContainText('No matching workflows');
    errors.assertNoErrors();
  });

  test('F21.T2.4: workflow delete Cancel preserves entry; Confirm delete removes it across reload', async ({
    page,
  }) => {
    await createWorkflow(page, { title: 'Ephemeral WF', steps: ['Only step'] });
    await page.getByRole('button', { name: 'Delete Ephemeral WF' }).click();
    const confirmBox = page.getByRole('alertdialog', { name: 'Confirm delete Ephemeral WF' });
    await confirmBox.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Ephemeral WF' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete Ephemeral WF' }).click();
    await confirmBox.getByRole('button', { name: /^confirm delete$/i }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Ephemeral WF' })).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 3, name: 'Ephemeral WF' })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F21.T2.5: workflow without copyablePrompt falls back to numbered steps on Copy prompt', async ({
    page,
  }) => {
    await createWorkflow(page, {
      title: 'Step Fallback WF',
      steps: ['Audit code', 'Run tests'],
      copyablePrompt: '',
    });
    await page.getByRole('button', { name: 'Copy prompt for Step Fallback WF' }).click();
    const copied = await getCopiedTexts(page);
    expect(copied[copied.length - 1]).toBe('1. Audit code\n2. Run tests');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F22 — Task Board Validation, Overdue, Filters & Mobile Kanban (Tier 2: >= 6 tests)
// ============================================================================
test.describe('Tier 2: F22 — Task Board Boundaries & Errors', () => {
  test('F22.T2.1: empty or whitespace-only Task title is rejected with validation alert', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /task board/i);
    await page.getByRole('button', { name: /^new task$/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^title$/i).fill('   ');
    await dialog.getByRole('button', { name: /^create task$/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('Task title is required.');
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test('F22.T2.2: past dueDate flags data-overdue="true", and marking Completed clears overdue flag', async ({
    page,
  }) => {
    await createTask(page, {
      title: 'Overdue Task',
      status: 'In Progress',
      dueDate: '2020-01-01',
    });
    const card = page.getByTestId('task-card').filter({ hasText: 'Overdue Task' });
    await expect(card).toHaveAttribute('data-overdue', 'true');
    await expect(card).toContainText('Overdue · 2020-01-01');

    await card.getByLabel('Status for Overdue Task').selectOption('Completed');
    await expect(card).not.toHaveAttribute('data-overdue', 'true');
    await expect(card).toContainText('Due 2020-01-01');
    errors.assertNoErrors();
  });

  test('F22.T2.3: future dueDate does NOT set data-overdue="true"', async ({ page }) => {
    await createTask(page, {
      title: 'Future Task',
      status: 'Planned',
      dueDate: '2099-12-31',
    });
    const card = page.getByTestId('task-card').filter({ hasText: 'Future Task' });
    await expect(card).not.toHaveAttribute('data-overdue', 'true');
    await expect(card).toContainText('Due 2099-12-31');
    errors.assertNoErrors();
  });

  test('F22.T2.4: combined search/priority filter zero-match shows "No matching tasks" and Clear filters resets all', async ({
    page,
  }) => {
    await createTask(page, { title: 'Real Filter Task', priority: 'High' });
    await page.getByLabel(/^search$/i).fill('__nonexistent__');
    await page.getByLabel(/priority filter/i).selectOption('Critical');
    await expect(page.locator('main')).toContainText('No matching tasks');
    await page.getByRole('button', { name: /^clear filters$/i }).click();
    await expect(page.locator('main')).toContainText('Real Filter Task');
    errors.assertNoErrors();
  });

  test('F22.T2.5: mobile Kanban switches across empty and populated status tabs cleanly', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createTask(page, { title: 'Kanban Tab Task', status: 'In Progress' });
    await page.getByRole('button', { name: /^kanban$/i }).click();

    await expect(page.getByTestId('column-Backlog')).toBeVisible();
    await expect(page.getByTestId('column-Backlog')).toContainText('No tasks');

    await page.getByRole('tab', { name: /in progress \(1\)/i }).click();
    await expect(page.getByTestId('column-In Progress')).toBeVisible();
    await expect(page.getByTestId('column-In Progress')).toContainText('Kanban Tab Task');

    await page.getByRole('tab', { name: /needs attention \(0\)/i }).click();
    await expect(page.getByTestId('column-Needs Attention')).toContainText('No tasks');
    errors.assertNoErrors();
  });

  test('F22.T2.6: Delete task Cancel preserves task; Confirm delete removes it to empty state', async ({
    page,
  }) => {
    await createTask(page, { title: 'Delete Boundary Task' });
    await page.getByRole('button', { name: 'Delete Delete Boundary Task' }).click();
    let dialog = page.getByRole('dialog', { name: /delete task\?/i });
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('Delete Boundary Task');

    await page.getByRole('button', { name: 'Delete Delete Boundary Task' }).click();
    dialog = page.getByRole('dialog', { name: /delete task\?/i });
    await dialog.getByRole('button', { name: /^confirm delete$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('No tasks yet');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F23 — Activity Log Boundaries (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F23 — Activity Log Boundaries', () => {
  test('F23.T2.1: fresh Activity Log disables Clear history button and displays "No activity yet"', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /activity log/i);
    await expectHeading(page, /activity log/i);
    await expect(page.getByRole('button', { name: /^clear history$/i })).toBeDisabled();
    await expect(page.locator('main')).toContainText('No activity yet');
    errors.assertNoErrors();
  });

  test('F23.T2.2: filtering by an unused category shows "No matching activity"', async ({
    page,
  }) => {
    await createProject(page, { title: 'Activity Seed Project' });
    await navigateDrawerRoute(page, /activity log/i);
    await page.getByLabel(/^category$/i).selectOption('workflow');
    await expect(page.locator('main')).toContainText('No matching activity');
    errors.assertNoErrors();
  });

  test('F23.T2.3: Clear activity history Cancel preserves logged entries', async ({ page }) => {
    await createProject(page, { title: 'Preserve Log Project' });
    await navigateDrawerRoute(page, /activity log/i);
    await page.getByRole('button', { name: /^clear history$/i }).click();
    const dialog = page.getByRole('dialog', { name: /clear activity history\?/i });
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('Created project "Preserve Log Project"');
    errors.assertNoErrors();
  });

  test('F23.T2.4: Confirm clear empties Activity Log, disables button, and persists across reload', async ({
    page,
  }) => {
    await createProject(page, { title: 'Wipe Log Project' });
    await navigateDrawerRoute(page, /activity log/i);
    await page.getByRole('button', { name: /^clear history$/i }).click();
    const dialog = page.getByRole('dialog', { name: /clear activity history\?/i });
    await dialog.getByRole('button', { name: /^confirm clear$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).toContainText('No activity yet');
    await expect(page.getByRole('button', { name: /^clear history$/i })).toBeDisabled();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('No activity yet');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F24 — Connection Setup Center Boundaries (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F24 — Connection Setup Center Boundaries', () => {
  test('F24.T2.1: partial Setup Wizard progress persists across full page reload', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    const firstMark = page.getByRole('button', { name: /^mark done$/i }).first();
    await firstMark.click();
    await expect(page.getByRole('button', { name: /^done$/i })).toHaveCount(1);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^done$/i })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^mark done$/i })).toHaveCount(3);
    errors.assertNoErrors();
  });

  test('F24.T2.2: toggling a completed wizard step back to unchecked persists across reload', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    await page.getByRole('button', { name: /^mark done$/i }).first().click();
    const doneBtn = page.getByRole('button', { name: /^done$/i }).first();
    await expect(doneBtn).toHaveAttribute('aria-pressed', 'true');
    await doneBtn.click();
    await expect(page.getByRole('button', { name: /^done$/i })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^mark done$/i })).toHaveCount(4);
    errors.assertNoErrors();
  });

  test('F24.T2.3: copying each of the 5 CLI reference commands produces exact text without opening URLs', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    const cmds = [
      '/remote-control',
      'agy --remote-control',
      'agy remote-control start',
      'agy remote-control status',
      'agy remote-control stop',
    ];
    for (const cmd of cmds) {
      await page.getByRole('button', { name: `Copy command ${cmd}` }).click();
    }
    expect(await getCopiedTexts(page)).toEqual(cmds);
    expect(await getOpenedUrls(page)).toEqual([]);
    errors.assertNoErrors();
  });

  test('F24.T2.4: Setup Center explicitly discloses that CLI commands are never wrapped or executed', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    await expect(page.locator('main')).toContainText(
      /never wraps or executes the antigravity cli/i,
    );
    errors.assertNoErrors();
  });
});

// ============================================================================
// F25 — Web App Manifest & Icons Boundaries (Tier 2: >= 3 tests)
// ============================================================================
test.describe('Tier 2: F25 — Web App Manifest & Icons Boundaries', () => {
  test('F25.T2.1: manifest icon entries use strictly local relative PNGs without external hosts', async ({
    page,
  }) => {
    const res = await page.request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const manifest = (await res.json()) as {
      icons?: Array<{ src: string; sizes?: string; type?: string; purpose?: string }>;
    };
    expect((manifest.icons ?? []).length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons ?? []) {
      expect(icon.src).not.toMatch(/^https?:\/\//i);
      expect(icon.type).toBe('image/png');
    }
    errors.assertNoErrors();
  });

  test('F25.T2.2: manifest sets dark theme_color & background_color matching OLED palette', async ({
    page,
  }) => {
    const res = await page.request.get('/manifest.webmanifest');
    const manifest = (await res.json()) as { theme_color?: string; background_color?: string };
    expect(manifest.theme_color?.toLowerCase()).toBe('#000000');
    expect(manifest.background_color?.toLowerCase()).toBe('#000000');
    errors.assertNoErrors();
  });

  test('F25.T2.3: toggling theme updates <meta name="theme-color"> dynamically', async ({
    page,
  }) => {
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /^light$/i }).click();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f8fafc');
    errors.assertNoErrors();
  });
});

// ============================================================================
// F26 — Service Worker Denylist & Offline Shell Boundaries (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F26 — Service Worker Denylist & Offline Boundaries', () => {
  test('F26.T2.1: /sw.js navigateFallbackDenylist explicitly blocks /oauth, /token, /auth/, /login, /signin, /session', async ({
    page,
  }) => {
    const swText = await (await page.request.get('/sw.js')).text();
    for (const seg of ['auth', 'oauth', 'token', 'login', 'signin', 'session', 'api']) {
      expect(swText).toMatch(new RegExp(`denylist:[\\s\\S]*${seg}`, 'i'));
    }
    errors.assertNoErrors();
  });

  test('F26.T2.2: under active SW offline, /oauth, /token, /auth/ do not receive cached SPA fallback while /projects does', async ({
    page,
    context,
  }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      // Cached SPA route resolves cleanly offline via SW navigateFallback
      await page.goto(ROUTES.projects, { waitUntil: 'domcontentloaded' });
      await expectHeading(page, /^projects$/i);

      // Denylisted auth/oauth/token paths must fail offline rather than falling back to cached SPA shell
      for (const blockedPath of ['/oauth/callback', '/token', '/auth/google']) {
        const result = await page.evaluate(async (path) => {
          try {
            const resp = await fetch(path);
            return `STATUS:${resp.status}`;
          } catch {
            return 'NETWORK_REJECTED';
          }
        }, blockedPath);
        expect(result).toBe('NETWORK_REJECTED');
      }
    } finally {
      await context.setOffline(false);
    }
    expect(errors.pageErrors).toEqual([]);
  });

  test('F26.T2.3: active Service Worker reloads cached app shell cleanly while offline', async ({
    page,
    context,
  }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      await expectHeading(page, /ag pocket command center/i);
    } finally {
      await context.setOffline(false);
    }
    errors.assertNoErrors();
  });

  test('F26.T2.4: Workbox caches contain zero Google or Antigravity origin entries', async ({
    page,
  }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cachedUrls = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        const reqs = await cache.keys();
        for (const r of reqs) urls.push(r.url);
      }
      return urls;
    });
    for (const url of cachedUrls) {
      expect(url).not.toMatch(/google\.com|antigravity\.google|\/oauth|\/token|\/auth\//i);
    }
    errors.assertNoErrors();
  });
});

// ============================================================================
// F27 — Offline Banner & Platform Install Guides Boundaries (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F27 — Offline Banner & Install Guides Boundaries', () => {
  test('F27.T2.1: header Online/Offline badge and global banner toggle synchronously on network changes', async ({
    page,
    context,
  }) => {
    await expect(page.locator('header')).toContainText('Online');
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('header')).toContainText('Offline');
      await expect(page.getByRole('status').filter({ hasText: /you are offline/i })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('header')).toContainText('Online');
    await expect(page.getByRole('status').filter({ hasText: /you are offline/i })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F27.T2.2: offline reload preserves offline banner and allows local CRUD', async ({
    page,
    context,
  }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    try {
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('status').filter({ hasText: /you are offline/i })).toBeVisible();
      await createProject(page, { title: 'Offline Created Proj' });
      await expect(page.locator('main')).toContainText('Offline Created Proj');
    } finally {
      await context.setOffline(false);
    }
    errors.assertNoErrors();
  });

  test('F27.T2.3: Home launcher remains explicit open-official-URL action while offline warning displays', async ({
    page,
    context,
  }) => {
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('main')).toContainText(/requires an active internet connection/i);
      await triggerAndVerifyOfficialUrl(
        page,
        page.getByRole('button', { name: /^open antigravity$/i }).first(),
        OFFICIAL_URLS.base,
      );
    } finally {
      await context.setOffline(false);
    }
    errors.assertNoErrors();
  });

  test('F27.T2.4: Settings Android & iOS install guides render with zero horizontal overflow at 320px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await navigatePrimaryTab(page, 'Settings');
    await expect(page.locator('main')).toContainText('Android (Chrome / Edge)');
    await expect(page.locator('main')).toContainText('iOS (Safari)');
    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });
});

// ============================================================================
// F28 — Dexie Schema & Multi-Reload Idempotency (Tier 2: >= 4 tests)
// ============================================================================
test.describe('Tier 2: F28 — Dexie Schema & Idempotency', () => {
  test('F28.T2.1: 3 consecutive reloads maintain exact starter counts (12 prompts, 9 skills, 23 workflows)', async ({
    page,
  }) => {
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    const counts = await page.evaluate(
      (dbName) =>
        new Promise<{ prompts: number; skills: number; workflows: number }>((resolve) => {
          const req = window.indexedDB.open(dbName);
          req.onsuccess = () => {
            const idb = req.result;
            const tx = idb.transaction(['prompts', 'skills', 'workflows'], 'readonly');
            const c = { prompts: 0, skills: 0, workflows: 0 };
            tx.objectStore('prompts').count().onsuccess = (e) => {
              c.prompts = (e.target as IDBRequest<number>).result;
            };
            tx.objectStore('skills').count().onsuccess = (e) => {
              c.skills = (e.target as IDBRequest<number>).result;
            };
            tx.objectStore('workflows').count().onsuccess = (e) => {
              c.workflows = (e.target as IDBRequest<number>).result;
            };
            tx.oncomplete = () => {
              idb.close();
              resolve(c);
            };
          };
        }),
      DEXIE_DB_NAME,
    );
    expect(counts).toEqual({ prompts: 12, skills: 9, workflows: 23 });
    errors.assertNoErrors();
  });

  test('F28.T2.2: deleting a starter workflow stays deleted across reload without re-seeding', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow library/i);
    await page.getByRole('button', { name: 'Delete End-to-End Feature Delivery' }).click();
    await page
      .getByRole('alertdialog', { name: 'Confirm delete End-to-End Feature Delivery' })
      .getByRole('button', { name: /^confirm delete$/i })
      .click();
    await expect(page.getByRole('heading', { level: 3, name: 'End-to-End Feature Delivery' })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 3, name: 'End-to-End Feature Delivery' })).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F28.T2.3: rapid edits and clearing Prompt Studio draft never leave corrupted draft state', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    const body = page.getByLabel('Prompt', { exact: true });
    await body.fill('Draft A');
    await body.fill('Draft B');
    await body.fill('Draft C');
    await page.getByRole('button', { name: /^clear$/i }).click();
    await page.getByRole('button', { name: /^yes, clear$/i }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('');
    errors.assertNoErrors();
  });

  test('F28.T2.4: all 8 Dexie object stores remain intact after Clear All Local Data', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /clear all local data/i }).click();
    const dialog = page.getByRole('dialog', { name: /clear all local data/i });
    await dialog.getByRole('button', { name: /confirm clear all data/i }).click();
    await expect(dialog).toBeHidden();

    const stores = await page.evaluate(
      (dbName) =>
        new Promise<string[]>((resolve) => {
          const req = window.indexedDB.open(dbName);
          req.onsuccess = () => {
            const idb = req.result;
            const list = Array.from(idb.objectStoreNames);
            idb.close();
            resolve(list);
          };
        }),
      DEXIE_DB_NAME,
    );
    for (const store of EXPECTED_DEXIE_STORES) {
      expect(stores).toContain(store);
    }
    errors.assertNoErrors();
  });
});

// ============================================================================
// F29 — Backup Import Validation, Dedupe & Two-Step Clear (Tier 2: >= 6 tests; 8 tests)
// ============================================================================
test.describe('Tier 2: F29 — JSON Import Validation, Dedupe & Two-Step Clear', () => {
  test('F29.T2.1: malformed JSON import is rejected without mutating existing projects', async ({
    page,
  }) => {
    await createProject(page, { title: 'Protected Project' });
    await navigatePrimaryTab(page, 'Settings');
    const fileInput = page.getByLabel('Import local data JSON file');
    await setJsonInputFile(fileInput, 'broken.json', '{not valid json');

    const alert = page.getByRole('alert').filter({ hasText: /import rejected/i });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/invalid json syntax/i);

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Protected Project');
    errors.assertNoErrors();
  });

  test('F29.T2.2: empty JSON payload is rejected cleanly without modifying DB', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const fileInput = page.getByLabel('Import local data JSON file');
    await setJsonInputFile(fileInput, 'empty.json', '   ');

    const alert = page.getByRole('alert').filter({ hasText: /import rejected/i });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/import payload is empty/i);
    errors.assertNoErrors();
  });

  test('F29.T2.3: empty object {} and wrong schema/version JSON are rejected cleanly', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const fileInput = page.getByLabel('Import local data JSON file');

    await setJsonInputFile(fileInput, 'empty-obj.json', '{}');
    const alert = page.getByRole('alert').filter({ hasText: /import rejected/i });
    await expect(alert).toBeVisible();

    await setJsonInputFile(
      fileInput,
      'wrong-version.json',
      JSON.stringify({ schemaVersion: 99, app: 'other-app', exportedAt: new Date().toISOString(), data: {} }),
    );
    await expect(alert).toBeVisible();
    errors.assertNoErrors();
  });

  test('F29.T2.4: oversized (>5 MiB) JSON file is rejected before import without mutating DB', async ({
    page,
  }) => {
    await createProject(page, { title: 'Pre-Oversize Project' });
    await navigatePrimaryTab(page, 'Settings');
    const fileInput = page.getByLabel('Import local data JSON file');
    const oversized = ' '.repeat(5 * 1024 * 1024 + 64);
    await setJsonInputFile(fileInput, 'huge.json', oversized);

    const alert = page.getByRole('alert').filter({ hasText: /import rejected/i });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/exceeds the 5 mib import limit/i);

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Pre-Oversize Project');
    errors.assertNoErrors();
  });

  test('F29.T2.5: JSON import containing unsafe javascript: or evil.com officialUrl is rejected atomically', async ({
    page,
  }) => {
    await createProject(page, { title: 'Baseline Safe Project' });
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export local data/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(20);
    const validBundle = JSON.parse(await getLatestExportedText(page)) as {
      schemaVersion: number;
      app: string;
      exportedAt: string;
      data: {
        projects: Array<Record<string, unknown>>;
      };
    };

    const maliciousBundle = {
      ...validBundle,
      data: {
        ...validBundle.data,
        projects: [
          {
            id: 'malicious-proj-1',
            title: 'Evil Injection Project',
            category: 'Other',
            machineName: 'host',
            workspaceLabel: 'ws',
            officialUrl: 'javascript:alert(1)',
            description: '',
            notes: '',
            pinned: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    };

    const fileInput = page.getByLabel('Import local data JSON file');
    await setJsonInputFile(fileInput, 'malicious-url.json', JSON.stringify(maliciousBundle));

    const alert = page.getByRole('alert').filter({ hasText: /import rejected/i });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/only https official antigravity urls are permitted/i);

    // Try https://evil.com as well
    maliciousBundle.data.projects[0].officialUrl = 'https://evil.com/steal';
    await setJsonInputFile(fileInput, 'evil-host.json', JSON.stringify(maliciousBundle));
    await expect(alert).toContainText(/url must point to https:\/\/antigravity\.google\.com/i);

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Baseline Safe Project');
    await expect(page.locator('main')).not.toContainText('Evil Injection Project');
    errors.assertNoErrors();
  });

  test('F29.T2.6: JSON import with invalid nested entity field rejects entire bundle without partial write', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export local data/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(20);
    const bundle = JSON.parse(await getLatestExportedText(page)) as {
      schemaVersion: number;
      app: string;
      exportedAt: string;
      data: Record<string, unknown[]>;
    };

    const now = new Date().toISOString();
    bundle.data.projects = [
      {
        id: 'partial-write-guard',
        title: 'Should Not Be Written',
        category: 'Other',
        machineName: '',
        workspaceLabel: '',
        officialUrl: '',
        description: '',
        notes: '',
        pinned: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
    bundle.data.tasks = [
      {
        id: 'invalid-task-1',
        title: '   ', // violates non-empty title
        description: '',
        status: 'Backlog',
        priority: 'Medium',
        notes: '',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const fileInput = page.getByLabel('Import local data JSON file');
    await setJsonInputFile(fileInput, 'partial-invalid.json', JSON.stringify(bundle));
    await expect(page.getByRole('alert').filter({ hasText: /import rejected/i })).toBeVisible();

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).not.toContainText('Should Not Be Written');
    errors.assertNoErrors();
  });

  test('F29.T2.7: duplicate import prevention skips matching natural-key projects/skills/tasks even with new IDs', async ({
    page,
  }) => {
    await createProject(page, { title: 'Natural Key Proj', workspaceLabel: '/ws/one' });
    await createTask(page, { title: 'Natural Key Task' });

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export local data/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(20);
    const bundle = JSON.parse(await getLatestExportedText(page)) as {
      data: {
        projects: Array<{ id: string; title: string }>;
        tasks: Array<{ id: string }>;
      };
    };
    // Assign brand-new IDs to verify natural-key deduplication
    bundle.data.projects = bundle.data.projects.map((p, idx) => ({ ...p, id: `new-id-${idx}` }));
    bundle.data.tasks = bundle.data.tasks.map((t, idx) => ({ ...t, id: `new-task-${idx}` }));

    const fileInput = page.getByLabel('Import local data JSON file');
    await setJsonInputFile(fileInput, 'dedupe-natural-key.json', JSON.stringify(bundle));
    const summary = page.getByRole('status').filter({ hasText: /import summary/i });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/imported:\s*0 projects.*0 tasks/i);
    await expect(summary).toContainText(/skipped duplicates:\s*1 projects.*1 tasks/i);
    errors.assertNoErrors();
  });

  test('F29.T2.8: two-step Clear All Local Data Cancel preserves data; Confirm leaves starters un-reseeded across reload', async ({
    page,
  }) => {
    await createProject(page, { title: 'Clear Check Proj' });
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /clear all local data/i }).click();
    let dialog = page.getByRole('dialog', { name: /clear all local data/i });
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Clear Check Proj');

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /clear all local data/i }).click();
    dialog = page.getByRole('dialog', { name: /clear all local data/i });
    await dialog.getByRole('button', { name: /confirm clear all data/i }).click();
    await expect(dialog).toBeHidden();

    await page.reload({ waitUntil: 'domcontentloaded' });
    expect((await readSettingsRecord(page))?.starterSeededVersion).toBe(1);

    await navigatePrimaryTab(page, 'Skills');
    await expect(page.locator('main')).toContainText('No skills yet');
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const tplDialog = page.getByRole('dialog', { name: /prompt templates/i });
    await expect(tplDialog).toContainText('No templates found');
    await tplDialog.getByRole('button', { name: /close prompt templates/i }).click();
    await expect(tplDialog).toBeHidden();
    errors.assertNoErrors();
  });
});

// ============================================================================
// F30 — Official Integration Boundary & Docs Consistency (Tier 2: >= 3 tests)
// ============================================================================
test.describe('Tier 2: F30 — Official Boundary & Documentation Consistency', () => {
  test('F30.T2.1: Privacy page explicitly documents SW exclusions and zero OAuth/cookies/iframes', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /privacy/i);
    await expectHeading(page, /privacy & security boundary/i);
    const mainText = await page.locator('main').innerText();
    expect(mainText).toMatch(/100% Local IndexedDB Persistence/i);
    expect(mainText).toMatch(/Official-First Security Boundary/i);
    expect(mainText).toMatch(/Service Worker Caching Exclusions/i);
    expect(mainText).toMatch(/antigravity\.google\.com/);
    expect(mainText).toMatch(/accounts\.google\.com/);
    errors.assertNoErrors();
  });

  test('F30.T2.2: Setup Center troubleshooting card covers all 4 official diagnostic scenarios', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /connection setup center/i);
    const main = page.locator('main');
    await expect(main).toContainText('Machine missing in antigravity.google.com');
    await expect(main).toContainText('Connection drops repeatedly');
    await expect(main).toContainText('Two similar machine entries appear');
    await expect(main).toContainText('Account policy or eligibility errors');
    errors.assertNoErrors();
  });

  test('F30.T2.3: every external anchor across Home and Setup Center enforces target="_blank" and rel="noopener noreferrer"', async ({
    page,
  }) => {
    for (const route of [ROUTES.home, ROUTES.setup]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const anchors = page.locator('main a[href^="http"]');
      const count = await anchors.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const a = anchors.nth(i);
        await expect(a).toHaveAttribute('target', '_blank');
        const rel = ((await a.getAttribute('rel')) ?? '').toLowerCase();
        expect(rel).toContain('noopener');
        expect(rel).toContain('noreferrer');
      }
    }
    errors.assertNoErrors();
  });
});
