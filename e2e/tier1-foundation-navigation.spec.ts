import { expect, test } from '@playwright/test';
import {
  assertZeroForbiddenDomAndStorage,
  assertZeroHorizontalOverflow,
  attachErrorListeners,
  attachSecurityNetworkGuard,
  closeNavDrawer,
  CONNECTION_READINESS_STATES,
  DRAWER_ROUTE_ITEMS,
  expectHeading,
  getThemeSnapshot,
  installWindowOpenSpy,
  navigateDrawerRoute,
  navigatePrimaryTab,
  OFFICIAL_URLS,
  openNavDrawer,
  PRIMARY_NAV_LABELS,
  PRIMARY_NAV_ROUTES,
  resetAppState,
  readSettingsRecord,
  ROUTES,
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
  await resetAppState(page);
});

test.afterEach(() => {
  networkGuard.assertClean();
  errors.assertNoErrors();
});

test.describe('F1 — Core Runtime & Libraries', () => {
  test('F1.1: app boots at / with non-empty #root, visible main landmark, and zero runtime errors', async ({
    page,
  }) => {
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('main')).toBeVisible();
    await expectHeading(page, /ag pocket/i);
    errors.assertNoErrors();
    networkGuard.assertClean();
  });

  test('F1.2: document metadata sets lang="en", AG Pocket title, and responsive viewport meta', async ({
    page,
  }) => {
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
    await expect(page).toHaveTitle(/ag pocket/i);
    const viewportContent = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(viewportContent ?? '').toContain('width=device-width');
    errors.assertNoErrors();
  });

  test('F1.3: favicon SVG and apple-touch-icon link assets resolve with HTTP 200', async ({
    page,
  }) => {
    const faviconHref = await page.locator('link[rel="icon"]').first().getAttribute('href');
    const appleHref = await page
      .locator('link[rel="apple-touch-icon"]')
      .first()
      .getAttribute('href');
    expect(faviconHref).toBeTruthy();
    expect(appleHref).toBeTruthy();

    const faviconRes = await page.request.get(faviconHref ?? '/favicon.svg');
    expect(faviconRes.status()).toBe(200);
    const appleRes = await page.request.get(appleHref ?? '/apple-touch-icon.png');
    expect(appleRes.status()).toBe(200);
    errors.assertNoErrors();
  });

  test('F1.4: client-side SPA navigation preserves in-memory window marker across routes', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__bootMarker = 'spa-alive-m1';
    });

    await navigatePrimaryTab(page, 'Projects');
    await expectHeading(page, /projects/i);
    await navigatePrimaryTab(page, 'Settings');
    await expectHeading(page, /settings/i);

    const marker = await page.evaluate(() => window.__bootMarker);
    expect(marker).toBe('spa-alive-m1');
    errors.assertNoErrors();
  });

  test('F1.5: browser history back and forward traverse SPA routes cleanly', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await expect(page).toHaveURL(/\/projects$/);
    await navigatePrimaryTab(page, 'Prompts');
    await expect(page).toHaveURL(/\/prompts$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/projects$/);
    await expectHeading(page, /projects/i);

    await page.goForward();
    await expect(page).toHaveURL(/\/prompts$/);
    await expectHeading(page, /prompt/i);
    errors.assertNoErrors();
  });
});

test.describe('F2 — Vercel Static Deployment Config & Deep-Link SPA Routing', () => {
  test('F2.1: direct navigation to /setup renders Connection Setup Center', async ({
    page,
  }) => {
    const response = await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expectHeading(page, /connection|setup/i);
    errors.assertNoErrors();
  });

  test('F2.2: direct deep-links across all core modules resolve cleanly without error', async ({
    page,
  }) => {
    const deepRoutes = [
      { path: ROUTES.projects, heading: /projects/i },
      { path: ROUTES.prompts, heading: /prompt/i },
      { path: ROUTES.skills, heading: /skill/i },
      { path: ROUTES.workflows, heading: /workflow/i },
      { path: ROUTES.tasks, heading: /task/i },
      { path: ROUTES.activity, heading: /activity/i },
      { path: ROUTES.settings, heading: /settings/i },
      { path: ROUTES.privacy, heading: /privacy/i },
    ];

    for (const item of deepRoutes) {
      const response = await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('main')).toBeVisible();
      await expectHeading(page, item.heading);
    }
    errors.assertNoErrors();
  });

  test('F2.3: unknown wildcard route falls back safely with navigation back to Home', async ({
    page,
  }) => {
    await page.goto('/does-not-exist-404', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await navigatePrimaryTab(page, 'Home');
    await expect(page).toHaveURL(/\/$/);
    errors.assertNoErrors();
  });

  test('F2.4: unknown project detail route renders graceful empty or not-found state', async ({
    page,
  }) => {
    await page.goto(ROUTES.projectDetail('nonexistent-project-id'), {
      waitUntil: 'domcontentloaded',
    });
    const main = page.locator('main');
    await expect(main).toBeVisible();
    await expect(main).toContainText(/project not found/i);
    await expect(main.getByRole('link', { name: /back to projects/i })).toBeVisible();
    errors.assertNoErrors();
  });

  test('F2.5: deep-link with query/hash and static /offline.html resolve cleanly', async ({
    page,
  }) => {
    const setupRes = await page.goto(`${ROUTES.setup}?tab=mobile#cli`, {
      waitUntil: 'domcontentloaded',
    });
    expect(setupRes?.status()).toBeLessThan(400);
    await expectHeading(page, /connection|setup/i);

    const offlineRes = await page.request.get('/offline.html');
    expect(offlineRes.status()).toBe(200);
    const offlineHtml = await offlineRes.text();
    expect(offlineHtml).toMatch(/ag pocket/i);
    errors.assertNoErrors();
  });
});

test.describe('F3 — Official-First Companion Boundary', () => {
  test('F3.1: Home OPEN ANTIGRAVITY CTA opens https://antigravity.google.com with noopener,noreferrer', async ({
    page,
  }) => {
    const launchCta = page
      .getByRole('button', { name: /open antigravity/i })
      .or(page.getByRole('link', { name: /open antigravity/i }))
      .first();
    await triggerAndVerifyOfficialUrl(page, launchCta, OFFICIAL_URLS.base);
    errors.assertNoErrors();
  });

  test('F3.2: triggering official launch keeps SPA on / and emits zero external requests', async ({
    page,
  }) => {
    const launchCta = page
      .getByRole('button', { name: /open antigravity/i })
      .or(page.getByRole('link', { name: /open antigravity/i }))
      .first();
    await triggerAndVerifyOfficialUrl(page, launchCta, OFFICIAL_URLS.base);
    await expect(page).toHaveURL(/\/$/);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });

  test('F3.3: Setup Center official doc links point exclusively to antigravity.google/docs/* with safe attrs', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    await expectHeading(page, /connection|setup/i);

    const expectedDocs = [
      { label: /remote control/i, url: OFFICIAL_URLS.docsRemoteControl },
      { label: /remote agents/i, url: OFFICIAL_URLS.docsRemoteAgents },
      { label: /faq/i, url: OFFICIAL_URLS.docsFaq },
    ];

    for (const doc of expectedDocs) {
      const link = page
        .getByRole('link', { name: doc.label })
        .or(page.getByRole('button', { name: doc.label }))
        .first();
      await triggerAndVerifyOfficialUrl(page, link, doc.url);
    }
    errors.assertNoErrors();
  });

  test('F3.4: official-first companion boundary is visibly disclosed on Home, Setup, and Privacy', async ({
    page,
  }) => {
    await expect(page.locator('main')).toContainText(/antigravity\.google\.com/i);

    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText(/antigravity\.google/i);

    await page.goto(ROUTES.privacy, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText(/antigravity\.google/i);
    errors.assertNoErrors();
  });

  test('F3.5: navigating across all 10 routes emits zero external network requests', async ({
    page,
  }) => {
    const allRoutes = [
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
    for (const route of allRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
    }
    networkGuard.assertClean();
    errors.assertNoErrors();
  });
});

test.describe('F4 — Disabled Future Integration Adapter', () => {
  test('F4.1: zero active local bridge, server pairing, or live-stream controls exist', async ({
    page,
  }) => {
    for (const route of [ROUTES.home, ROUTES.setup, ROUTES.settings]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const forbiddenControl = page.getByRole('button', {
        name: /connect bridge|pair local server|start live stream|approve command/i,
      });
      await expect(forbiddenControl).toHaveCount(0);
    }
    errors.assertNoErrors();
  });

  test('F4.2: Setup, Settings, or Privacy discloses automated API integration is disabled/unavailable', async ({
    page,
  }) => {
    await page.goto(ROUTES.privacy, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText(
      /no backend|disabled|public.*api|official.*api|not.*connect|cannot.*verify/i,
    );
    errors.assertNoErrors();
  });

  test('F4.3: Home status indicator displays only locally knowable states, never live Connected state', async ({
    page,
  }) => {
    const bodyText = await page.locator('main').innerText();
    const hasKnowableState = CONNECTION_READINESS_STATES.some((state) =>
      bodyText.toLowerCase().includes(state.toLowerCase()),
    );
    expect(hasKnowableState).toBe(true);
    expect(bodyText).not.toMatch(/\bLive Connected\b|\bAgent Online\b/i);
    errors.assertNoErrors();
  });

  test('F4.4: Prompt Studio explicitly frames action as copying locally rather than automated submission', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await expectHeading(page, /prompt/i);
    await expect(page.locator('main')).toContainText(/nothing is sent anywhere/i);
    await expect(page.getByRole('button', { name: /copy/i }).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /submit directly to agent|auto-submit/i }),
    ).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F4.5: idling on Home and Task Board produces zero background polling requests', async ({
    page,
  }) => {
    const initialCount = networkGuard.allRequests.length;
    await page.waitForTimeout(1000);
    await navigateDrawerRoute(page, /task/i);
    await expect(page.getByRole('heading', { level: 1, name: /task board/i })).toBeVisible();
    const afterNavCount = networkGuard.allRequests.length;
    await page.waitForTimeout(1200);
    expect(networkGuard.allRequests.length).toBe(afterNavCount);
    expect(afterNavCount).toBeGreaterThanOrEqual(initialCount);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });
});

test.describe('F5 — Strictly Forbidden Behaviors Removal', () => {
  test('F5.1: zero iframe elements exist across Home, Setup, Projects, Prompts, and Settings', async ({
    page,
  }) => {
    for (const route of [
      ROUTES.home,
      ROUTES.setup,
      ROUTES.projects,
      ROUTES.prompts,
      ROUTES.settings,
    ]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('iframe')).toHaveCount(0);
    }
    errors.assertNoErrors();
  });

  test('F5.2: zero OAuth tokens, credentials, or Google auth cookies exist in storage or cookies', async ({
    page,
  }) => {
    await assertZeroForbiddenDomAndStorage(page);
    await navigatePrimaryTab(page, 'Settings');
    await assertZeroForbiddenDomAndStorage(page);
    errors.assertNoErrors();
  });

  test('F5.3: legacy Commander bridge and simulator UI labels are completely absent', async ({
    page,
  }) => {
    for (const route of [ROUTES.home, ROUTES.projects, ROUTES.tasks, ROUTES.settings]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(
        /Bridge Settings|Approval Queue|Live Stream Feed|Session Switcher|Swarm Board/i,
      );
    }
    errors.assertNoErrors();
  });

  test('F5.4: zero WebSocket connections are opened during boot and navigation', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await navigatePrimaryTab(page, 'Prompts');
    await navigatePrimaryTab(page, 'Skills');
    await navigatePrimaryTab(page, 'Settings');
    expect(networkGuard.websockets).toEqual([]);
    errors.assertNoErrors();
  });

  test('F5.5: security network guard confirms zero requests to Google auth or private endpoints', async ({
    page,
  }) => {
    await navigateDrawerRoute(page, /workflow/i);
    await navigateDrawerRoute(page, /activity/i);
    await navigateDrawerRoute(page, /privacy/i);
    networkGuard.assertClean();
    errors.assertNoErrors();
  });
});

test.describe('F6 — Official URL Validation & Safe Content Handling', () => {
  test('F6.1: creating a project with valid https://antigravity.google.com session URL succeeds', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();

    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Official Session Project');
    const urlInput = page.getByRole('dialog').getByLabel(/session url/i);
    await urlInput.fill('https://antigravity.google.com/r/session-1');

    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.locator('main')).toContainText('Official Session Project');
    errors.assertNoErrors();
  });

  test('F6.2: creating a project with blank optional official URL succeeds cleanly', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();

    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Blank URL Project');
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();

    await expect(page.locator('main')).toContainText('Blank URL Project');
    errors.assertNoErrors();
  });

  test('F6.3: XSS payload in project title/notes renders as escaped plain text without execution', async ({
    page,
  }) => {
    const xssPayload = '<script>window.__xssTriggered=true</script>';
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();

    await page.getByRole('dialog').getByLabel(/^title$/i).fill(xssPayload);
    const notesInput = page.getByRole('dialog').getByLabel(/^notes$/i);
    if (await notesInput.isVisible().catch(() => false)) {
      await notesInput.fill(xssPayload);
    }
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();

    await expect(page.locator('main')).toContainText(xssPayload);
    const triggered = await page.evaluate(() => Boolean(window.__xssTriggered));
    expect(triggered).toBe(false);
    errors.assertNoErrors();
  });

  test('F6.4: HTML img-onerror payload in Prompt Studio renders safely without script execution', async ({
    page,
  }) => {
    const imgPayload = '<img src=x onerror="window.__xssTriggered=true">';
    await navigatePrimaryTab(page, 'Prompts');

    const editor = page.getByLabel('Prompt', { exact: true });
    await expect(editor).toBeVisible();
    await editor.fill(`Inspect ${imgPayload}`);

    const triggered = await page.evaluate(() => Boolean(window.__xssTriggered));
    expect(triggered).toBe(false);
    expect(await editor.inputValue()).toContain(imgPayload);
    errors.assertNoErrors();
  });

  test('F6.5: multiline project notes with newlines and quotes persist safely across reload', async ({
    page,
  }) => {
    const multilineNote = 'Line 1 "quoted"\nLine 2\tindented';
    await navigatePrimaryTab(page, 'Projects');
    await page.getByRole('button', { name: /^new project$/i }).first().click();

    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Multiline Safe Project');
    await page.getByRole('dialog').getByLabel(/^notes$/i).fill(multilineNote);
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await expect(page.locator('main')).toContainText('Multiline Safe Project');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('Multiline Safe Project');

    await page.getByRole('link', { name: 'Multiline Safe Project' }).click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expectHeading(page, 'Multiline Safe Project');

    await expect(page.locator('main')).toContainText('Line 1 "quoted"');
    await expect(page.locator('main')).toContainText('Line 2');
    await expect(page.locator('main')).toContainText('indented');
    const mainTextContent = await page.locator('main').textContent();
    expect(mainTextContent ?? '').toContain(multilineNote);
    await expect(page.locator('main img, main script')).toHaveCount(0);
    const triggered = await page.evaluate(() => Boolean(window.__xssTriggered));
    expect(triggered).toBe(false);
    errors.assertNoErrors();
  });
});

test.describe('F7 — OLED Dark Default + Light Theme & AG Monogram', () => {
  test('F7.1: initial boot defaults to OLED dark theme with low-luminance background', async ({
    page,
  }) => {
    const theme = await getThemeSnapshot(page);
    expect(theme.isDarkBg).toBe(true);
    errors.assertNoErrors();
  });

  test('F7.2: brand header renders AG Pocket identity and visible AG monogram SVG', async ({
    page,
  }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    await expect(header).toContainText(/ag pocket/i);
    await expect(header.locator('svg').first()).toBeVisible();
    errors.assertNoErrors();
  });

  test('F7.3: switching to Light theme in Settings updates DOM theme and increases luminance', async ({
    page,
  }) => {
    const darkSnapshot = await getThemeSnapshot(page);
    expect(darkSnapshot.isDarkBg).toBe(true);

    await navigatePrimaryTab(page, 'Settings');
    const lightOption = page
      .getByRole('button', { name: /^light$/i })
      .or(page.getByRole('radio', { name: /^light$/i }))
      .first();
    await expect(lightOption).toBeVisible();
    await lightOption.click();

    await expect
      .poll(async () => (await getThemeSnapshot(page)).isDarkBg)
      .toBe(false);
    errors.assertNoErrors();
  });

  test('F7.4: selected Light theme persists across full page reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const lightOption = page
      .getByRole('button', { name: /^light$/i })
      .or(page.getByRole('radio', { name: /^light$/i }))
      .first();
    await lightOption.click();

    await expect
      .poll(async () => (await getThemeSnapshot(page)).isDarkBg)
      .toBe(false);
    await expect.poll(async () => (await readSettingsRecord(page))?.theme).toBe('light');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(async () => (await getThemeSnapshot(page)).isDarkBg)
      .toBe(false);
    errors.assertNoErrors();
  });

  test('F7.5: primary OPEN ANTIGRAVITY CTA remains visible in both Dark and Light themes', async ({
    page,
  }) => {
    const cta = page
      .getByRole('button', { name: /open antigravity/i })
      .or(page.getByRole('link', { name: /open antigravity/i }))
      .first();
    await expect(cta).toBeVisible();

    await navigatePrimaryTab(page, 'Settings');
    await page
      .getByRole('button', { name: /^light$/i })
      .or(page.getByRole('radio', { name: /^light$/i }))
      .first()
      .click();
    await navigatePrimaryTab(page, 'Home');
    await expect(cta).toBeVisible();
    errors.assertNoErrors();
  });
});

test.describe('F8 — Accessibility & Ergonomics Baseline', () => {
  test('F8.1: semantic header, nav, main landmarks, and level-1 heading exist across primary routes', async ({
    page,
  }) => {
    for (const label of PRIMARY_NAV_LABELS) {
      await navigatePrimaryTab(page, label);
      await expect(page.locator('header').first()).toBeVisible();
      await expect(page.locator('main').first()).toBeVisible();
      await expect(page.locator('nav').first()).toBeVisible();
      await expect(page.locator('h1').first()).toBeVisible();
    }
    errors.assertNoErrors();
  });

  test('F8.2: primary nav items and primary Home CTA meet >=44x44 CSS px touch targets on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const label of PRIMARY_NAV_LABELS) {
      const navItem = page
        .locator('nav')
        .getByRole('link', { name: new RegExp(`^${label}$`, 'i') })
        .or(page.locator('nav').getByRole('button', { name: new RegExp(`^${label}$`, 'i') }))
        .first();
      const box = await navItem.boundingBox();
      expect(box, `Missing boundingBox for nav item ${label}`).not.toBeNull();
      if (box) {
        expect(box.width, `${label} width < 44px`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${label} height < 44px`).toBeGreaterThanOrEqual(44);
      }
    }

    const cta = page
      .getByRole('button', { name: /open antigravity/i })
      .or(page.getByRole('link', { name: /open antigravity/i }))
      .first();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    if (ctaBox) {
      expect(ctaBox.width).toBeGreaterThanOrEqual(44);
      expect(ctaBox.height).toBeGreaterThanOrEqual(44);
    }
    errors.assertNoErrors();
  });

  test('F8.3: keyboard Tab navigation advances focus across interactive controls', async ({
    page,
  }) => {
    await page.keyboard.press('Tab');
    const firstTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(firstTag).not.toBe('BODY');

    const firstLabel = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? '',
    );
    await page.keyboard.press('Tab');
    const secondTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    const secondLabel = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? '',
    );
    expect(secondTag).not.toBe('BODY');
    expect(firstTag === secondTag && firstLabel === secondLabel).toBe(false);
    errors.assertNoErrors();
  });

  test('F8.4: pressing Escape closes an open navigation drawer or modal sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openNavDrawer(page);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await page.keyboard.press('Escape');

    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F8.5: reduced-motion toggle in Settings persists across page reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const toggle = page
      .getByRole('switch', { name: /reduced motion|reduce motion/i })
      .or(page.getByRole('checkbox', { name: /reduced motion|reduce motion/i }))
      .first();
    await expect(toggle).toBeVisible();

    const beforeChecked = await toggle.isChecked();
    await toggle.click();
    await expect(toggle).toBeChecked({ checked: !beforeChecked });
    await expect.poll(async () => (await readSettingsRecord(page))?.reducedMotion).toBe(!beforeChecked);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(toggle).toBeChecked({ checked: !beforeChecked });
    errors.assertNoErrors();
  });
});

test.describe('F9 — Responsive Layout & Mobile Keyboard Handling', () => {
  test('F9.1: Home has zero horizontal overflow at narrow 320x568 mobile width', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.locator('main')).toBeVisible();
    await assertZeroHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test('F9.2: all 5 primary routes have zero horizontal overflow in 390x844 portrait and 844x390 landscape', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      for (const label of PRIMARY_NAV_LABELS) {
        await navigatePrimaryTab(page, label);
        await assertZeroHorizontalOverflow(page);
      }
    }
    errors.assertNoErrors();
  });

  test('F9.3: secondary routes have zero horizontal overflow at 360x740 mobile and 1440x900 desktop', async ({
    page,
  }) => {
    const secondaryRoutes = [
      ROUTES.setup,
      ROUTES.workflows,
      ROUTES.tasks,
      ROUTES.activity,
      ROUTES.privacy,
    ];
    for (const viewport of [
      { width: 360, height: 740 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of secondaryRoutes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main')).toBeVisible();
        await assertZeroHorizontalOverflow(page);
      }
    }
    errors.assertNoErrors();
  });

  test('F9.4: viewport meta configures viewport-fit=cover and interactive-widget=resizes-content', async ({
    page,
  }) => {
    const content =
      (await page.locator('meta[name="viewport"]').getAttribute('content')) ?? '';
    expect(content).toContain('viewport-fit=cover');
    expect(content).toContain('interactive-widget=resizes-content');
    errors.assertNoErrors();
  });

  test('F9.5: simulated virtual keyboard shrink (390x450) on Prompt Studio keeps editor and Copy button usable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigatePrimaryTab(page, 'Prompts');
    const editor = page.getByLabel('Prompt', { exact: true });
    await editor.focus();

    await page.setViewportSize({ width: 390, height: 450 });
    await assertZeroHorizontalOverflow(page);
    await expect(editor).toBeVisible();
    await expect(page.getByRole('button', { name: /copy/i }).first()).toBeVisible();
    errors.assertNoErrors();
  });
});

test.describe('F10 — Primary Bottom Nav + Secondary Drawer', () => {
  test('F10.1: primary navigation displays all 5 items (Home, Projects, Prompts, Skills, Settings)', async ({
    page,
  }) => {
    const nav = page.locator('nav');
    for (const label of PRIMARY_NAV_LABELS) {
      const item = nav
        .getByRole('link', { name: new RegExp(`^${label}$`, 'i') })
        .or(nav.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }))
        .first();
      await expect(item).toBeVisible();
    }
    errors.assertNoErrors();
  });

  test('F10.2: clicking each primary tab navigates to its route and marks active state', async ({
    page,
  }) => {
    for (const label of PRIMARY_NAV_LABELS) {
      await navigatePrimaryTab(page, label);
      const expectedPath = PRIMARY_NAV_ROUTES[label];
      expect(new URL(page.url()).pathname).toBe(expectedPath);
      const navLink = page
        .locator('nav')
        .getByRole('link', { name: new RegExp(`^${label}$`, 'i') })
        .first();
      await expect(navLink).toBeVisible();
      await expect(navLink).toHaveAttribute('aria-current', 'page');
    }
    errors.assertNoErrors();
  });

  test('F10.3: secondary navigation drawer lists all 5 secondary sections', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openNavDrawer(page);

    for (const item of DRAWER_ROUTE_ITEMS) {
      const entry = page
        .locator('nav, aside, [role="dialog"]')
        .getByRole('link', { name: item.pattern })
        .or(
          page
            .locator('nav, aside, [role="dialog"]')
            .getByRole('button', { name: item.pattern }),
        )
        .first();
      await expect(entry).toBeVisible();
    }
    errors.assertNoErrors();
  });

  test('F10.4: clicking each secondary drawer item navigates to its route and heading', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const item of DRAWER_ROUTE_ITEMS) {
      await navigateDrawerRoute(page, item.pattern);
      await expect(page).toHaveURL(new RegExp(`${item.route}$`));
      await expectHeading(page, item.pattern);
    }
    errors.assertNoErrors();
  });

  test('F10.5: selecting a drawer route automatically closes the drawer overlay', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigateDrawerRoute(page, /workflow/i);
    await expect(page).toHaveURL(/\/workflows$/);

    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    errors.assertNoErrors();
  });

  test('F10.6: opening and closing the navigation drawer preserves the current route', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigatePrimaryTab(page, 'Projects');
    const urlBefore = page.url();

    await openNavDrawer(page);
    await closeNavDrawer(page);

    expect(page.url()).toBe(urlBefore);
    await expectHeading(page, /projects/i);
    errors.assertNoErrors();
  });
});
