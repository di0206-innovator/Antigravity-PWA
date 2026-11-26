import { expect, test } from '@playwright/test';
import {
  attachErrorListeners,
  attachSecurityNetworkGuard,
  CLI_REFERENCE_COMMANDS,
  CONNECTION_READINESS_STATES,
  DEXIE_DB_NAME,
  EXPECTED_DEXIE_STORES,
  expectHeading,
  getCopiedTexts,
  getLatestExportedText,
  HOME_QUICK_ACTIONS,
  installClipboardSpy,
  installExportSpy,
  installWindowOpenSpy,
  MANIFEST_CONTRACT,
  navigatePrimaryTab,
  OFFICIAL_URLS,
  resetAppState,
  readSettingsRecord,
  ROUTES,
  setJsonInputFile,
  STARTER_PROMPT_TITLES,
  STARTER_SKILL_NAMES,
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

test.describe('F11 — Home Header & Locally Knowable Connection Status', () => {
  test('F11.1: Home header displays AG Pocket identity, time-based greeting, and current date', async ({
    page,
  }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    await expect(header).toContainText(/ag pocket/i);

    const mainText = await page.locator('main').innerText();
    const headerText = await header.innerText();
    const combined = `${headerText}\n${mainText}`;
    expect(combined).toMatch(/good (morning|afternoon|evening)|hello|welcome/i);

    const expectedDateParts = await page.evaluate(() => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(now);
      const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(now);
      const dayNumeric = new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(now);
      return { formatted, shortMonth, dayNumeric };
    });
    expect(combined).toContain(expectedDateParts.formatted);
    expect(combined).toContain(expectedDateParts.shortMonth);
    expect(combined).toContain(expectedDateParts.dayNumeric);
    errors.assertNoErrors();
  });

  test('F11.2: Settings shortcut in Home header navigates directly to /settings', async ({
    page,
  }) => {
    const settingsShortcut = page
      .locator('header')
      .getByRole('link', { name: /settings/i })
      .or(page.locator('header').getByRole('button', { name: /settings/i }))
      .first();
    await expect(settingsShortcut).toBeVisible();
    await settingsShortcut.click();

    await expect(page).toHaveURL(/\/settings$/);
    await expectHeading(page, /settings/i);
    errors.assertNoErrors();
  });

  test('F11.3: initial Home connection indicator shows a valid locally knowable state', async ({
    page,
  }) => {
    const text = await page.locator('main').innerText();
    const matchesKnowable = CONNECTION_READINESS_STATES.some((state) =>
      text.toLowerCase().includes(state.toLowerCase()),
    );
    expect(matchesKnowable).toBe(true);
    errors.assertNoErrors();
  });

  test('F11.4: completing setup steps updates local connection readiness on Home', async ({
    page,
  }) => {
    await expect(page.locator('main')).toContainText(/not configured/i);

    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    const pending = page.getByRole('button', { name: /^mark done$/i });
    await expect(pending.first()).toBeVisible();
    while ((await pending.count()) > 0) {
      const before = await pending.count();
      await pending.first().click();
      await expect(pending).toHaveCount(before - 1);
    }

    await navigatePrimaryTab(page, 'Home');
    const homeText = await page.locator('main').innerText();
    expect(homeText).toMatch(/ready to open/i);
    expect(homeText).not.toMatch(/not configured/i);
    errors.assertNoErrors();
  });

  test('F11.5: Home status area discloses that live remote Antigravity connection cannot be verified locally', async ({
    page,
  }) => {
    await expect(page.locator('main')).toContainText(/setup readiness \(local only\):/i);

    // Completing only step 1 (without mobile confirmation) surfaces explicit non-verification state.
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    const firstMarkDone = page.getByRole('button', { name: /^mark done$/i }).first();
    await expect(firstMarkDone).toBeVisible();
    await firstMarkDone.click();
    await expect(page.getByRole('button', { name: /^done$/i }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await navigatePrimaryTab(page, 'Home');
    const homeText = await page.locator('main').innerText();
    expect(homeText).toMatch(/remote connection not verified/i);
    expect(homeText).toMatch(/not both confirmed/i);
    expect(homeText).not.toMatch(/ready to open/i);
    errors.assertNoErrors();
  });
});

test.describe('F12 — Remote Control Launcher & Remote Access Info Cards', () => {
  test('F12.1: Antigravity Remote Control launcher card renders OPEN ANTIGRAVITY CTA', async ({
    page,
  }) => {
    const launchCta = page
      .getByRole('button', { name: /open antigravity/i })
      .or(page.getByRole('link', { name: /open antigravity/i }))
      .first();
    await expect(launchCta).toBeVisible();
    errors.assertNoErrors();
  });

  test('F12.2: clicking OPEN ANTIGRAVITY targets https://antigravity.google.com with noopener,noreferrer', async ({
    page,
  }) => {
    const launchCta = page
      .getByRole('button', { name: /open antigravity/i })
      .or(page.getByRole('link', { name: /open antigravity/i }))
      .first();
    await triggerAndVerifyOfficialUrl(page, launchCta, OFFICIAL_URLS.base);
    errors.assertNoErrors();
  });

  test('F12.3: Connection Setup Guide action on launcher navigates to /setup', async ({
    page,
  }) => {
    const setupLink = page
      .getByRole('link', { name: /connection setup guide|setup guide/i })
      .or(page.getByRole('button', { name: /connection setup guide|setup guide/i }))
      .first();
    await expect(setupLink).toBeVisible();
    await setupLink.click();
    await expect(page).toHaveURL(/\/setup$/);
    await expectHeading(page, /connection|setup/i);
    errors.assertNoErrors();
  });

  test('F12.4: Remote Access info card explains official browser Remote Control model', async ({
    page,
  }) => {
    await expect(page.locator('main')).toContainText(/remote control/i);
    await expect(page.locator('main')).toContainText(/antigravity\.google\.com|official/i);
    errors.assertNoErrors();
  });

  test('F12.5: launcher action emits zero external network requests and keeps SPA on /', async ({
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
});

test.describe('F13 — Home Quick Actions, Pinned Projects & Personal Task Overview', () => {
  test('F13.1: Home renders all 6 required Quick Action cards', async ({ page }) => {
    for (const action of HOME_QUICK_ACTIONS) {
      const control = page
        .locator('main')
        .getByRole('button', { name: new RegExp(action.label, 'i') })
        .or(page.locator('main').getByRole('link', { name: new RegExp(action.label, 'i') }))
        .first();
      await expect(control).toBeVisible();
    }
    errors.assertNoErrors();
  });

  test('F13.2: New Prompt, Browse Skills, and View Workflow Library quick actions navigate properly', async ({
    page,
  }) => {
    const routeActions = [
      { label: /new prompt/i, url: /\/prompts$/, heading: /prompt/i },
      { label: /browse skills/i, url: /\/skills$/, heading: /skill/i },
      { label: /view workflow library/i, url: /\/workflows$/, heading: /workflow/i },
    ];

    for (const item of routeActions) {
      await navigatePrimaryTab(page, 'Home');
      const control = page
        .locator('main')
        .getByRole('button', { name: item.label })
        .or(page.locator('main').getByRole('link', { name: item.label }))
        .first();
      await control.click();
      await expect(page).toHaveURL(item.url);
      await expectHeading(page, item.heading);
    }
    errors.assertNoErrors();
  });

  test('F13.3: Open Antigravity quick action targets official https://antigravity.google.com', async ({
    page,
  }) => {
    const quickActionsSection = page.getByRole('region', { name: /quick actions/i });
    const quickOpen = quickActionsSection.getByRole('button', {
      name: /^open antigravity\b/i,
    });
    await expect(quickOpen).toHaveCount(1);
    await triggerAndVerifyOfficialUrl(page, quickOpen, OFFICIAL_URLS.base);
    errors.assertNoErrors();
  });

  test('F13.4: New Project and New Task Note quick actions navigate to /projects and /tasks and open their dialogs', async ({
    page,
  }) => {
    await page
      .locator('main')
      .getByRole('button', { name: /new project/i })
      .or(page.locator('main').getByRole('link', { name: /new project/i }))
      .first()
      .click();
    await expect(page).toHaveURL(/\/projects$/);
    await expectHeading(page, /projects/i);
    // The quick action also opens the create form; dismiss it before navigating away.
    await expect(page.getByRole('dialog', { name: /new project/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Home');
    await page
      .locator('main')
      .getByRole('button', { name: /new task note/i })
      .or(page.locator('main').getByRole('link', { name: /new task note/i }))
      .first()
      .click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expectHeading(page, /task/i);
    await expect(page.getByRole('dialog', { name: /new task/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    errors.assertNoErrors();
  });

  test('F13.5: pinning a project in Projects surfaces it inside Home Pinned Projects section', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page
      .getByRole('button', { name: /^new project$/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Pinned Alpha Workspace');
    const pinCheckbox = page.getByRole('dialog').getByLabel(/pin this project/i);
    if (await pinCheckbox.isVisible().catch(() => false)) {
      if (!(await pinCheckbox.isChecked())) {
        await pinCheckbox.check();
      }
    }
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText(/pinned/i);
    await expect(page.locator('main')).toContainText('Pinned Alpha Workspace');
    errors.assertNoErrors();
  });

  test('F13.6: creating a personal task updates Home Task Overview with manual non-live note', async ({
    page,
  }) => {
    await page.goto(ROUTES.tasks, { waitUntil: 'domcontentloaded' });
    await page
      .getByRole('button', { name: /new task|add task|create task/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Verify PWA Manifest');
    await page.getByRole('dialog').getByRole('button', { name: /^(create task|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Home');
    await expect(page.locator('main')).toContainText(/task/i);
    await expect(page.locator('main')).toContainText('Verify PWA Manifest');
    errors.assertNoErrors();
  });
});

test.describe('F24 — Connection & Setup Center', () => {
  test('F24.1: /setup renders Desktop setup and Mobile setup (https://antigravity.google.com) sections', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    await expectHeading(page, /connection|setup/i);
    await expect(page.locator('main')).toContainText(/desktop/i);
    await expect(page.locator('main')).toContainText(/mobile/i);
    await expect(page.locator('main')).toContainText(/antigravity\.google\.com/i);
    errors.assertNoErrors();
  });

  test('F24.2: setup checklist progress persists across page reload', async ({ page }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    const firstStep = page.getByRole('button', { name: /mark done|done/i }).first();
    await expect(firstStep).toBeVisible();
    await firstStep.click();
    await expect(firstStep).toHaveAttribute('aria-pressed', 'true');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^done$/i }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    errors.assertNoErrors();
  });

  test('F24.3: all 5 non-executing CLI reference commands are displayed on Setup Center', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    const text = await page.locator('main').innerText();
    for (const cmd of CLI_REFERENCE_COMMANDS) {
      expect(text, `Missing CLI reference command: ${cmd}`).toContain(cmd);
    }
    errors.assertNoErrors();
  });

  test('F24.4: interactive vs daemon explanation is shown and copying a CLI command writes it to clipboard', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    const mainText = await page.locator('main').innerText();
    expect(mainText).toMatch(/interactive/i);
    expect(mainText).toMatch(/daemon|background/i);

    const copyBtn = page.getByRole('button', { name: /copy/i }).first();
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    const copied = await getCopiedTexts(page);
    expect(copied.length).toBeGreaterThan(0);
    const matchesAnyCli = CLI_REFERENCE_COMMANDS.some((cmd) => copied[0].includes(cmd));
    expect(matchesAnyCli).toBe(true);
    errors.assertNoErrors();
  });

  test('F24.5: Remote Agents explanation and Troubleshooting guide sections are visible', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText(/remote agents/i);
    await expect(page.locator('main')).toContainText(/troubleshooting/i);
    errors.assertNoErrors();
  });

  test('F24.6: official Google doc links (Remote Control, Remote Agents, FAQ) point safely to antigravity.google/docs/*', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    for (const item of [
      { name: /remote control/i, url: OFFICIAL_URLS.docsRemoteControl },
      { name: /remote agents/i, url: OFFICIAL_URLS.docsRemoteAgents },
      { name: /faq/i, url: OFFICIAL_URLS.docsFaq },
    ]) {
      const target = page
        .getByRole('link', { name: item.name })
        .or(page.getByRole('button', { name: item.name }))
        .first();
      await triggerAndVerifyOfficialUrl(page, target, item.url);
    }
    errors.assertNoErrors();
  });
});

test.describe('F25 — Web App Manifest & Icons', () => {
  test('F25.1: index.html includes <link rel="manifest"> and fetches valid HTTP 200 JSON', async ({
    page,
  }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const response = await page.request.get(manifestHref ?? '/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const parsed = (await response.json()) as Record<string, unknown>;
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();
    errors.assertNoErrors();
  });

  test('F25.2: manifest core metadata matches R5 specification exactly', async ({ page }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await page.request.get(manifestHref ?? '/manifest.webmanifest');
    const manifest = (await response.json()) as {
      name?: string;
      short_name?: string;
      display?: string;
      orientation?: string;
      start_url?: string;
      scope?: string;
    };

    expect(manifest.name).toBe(MANIFEST_CONTRACT.name);
    expect(manifest.short_name).toBe(MANIFEST_CONTRACT.short_name);
    expect(manifest.display).toBe(MANIFEST_CONTRACT.display);
    expect(manifest.orientation).toBe(MANIFEST_CONTRACT.orientation);
    expect(manifest.start_url).toBe(MANIFEST_CONTRACT.start_url);
    expect(manifest.scope).toBe(MANIFEST_CONTRACT.scope);
    errors.assertNoErrors();
  });

  test('F25.3: manifest theme_color and background_color are dark-theme coordinated hex values', async ({
    page,
  }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await page.request.get(manifestHref ?? '/manifest.webmanifest');
    const manifest = (await response.json()) as {
      theme_color?: string;
      background_color?: string;
    };

    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    errors.assertNoErrors();
  });

  test('F25.4: manifest declares 192x192, 512x512, and maskable 512x512 PNG icons that resolve HTTP 200', async ({
    page,
  }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await page.request.get(manifestHref ?? '/manifest.webmanifest');
    const manifest = (await response.json()) as {
      icons?: Array<{ src: string; sizes?: string; type?: string; purpose?: string }>;
    };

    const icons = manifest.icons ?? [];
    const icon192 = icons.find((i) => i.sizes === '192x192');
    const icon512 = icons.find(
      (i) => i.sizes === '512x512' && !(i.purpose ?? '').includes('maskable'),
    );
    const iconMaskable = icons.find(
      (i) => i.sizes === '512x512' && (i.purpose ?? '').includes('maskable'),
    );

    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();
    expect(iconMaskable).toBeDefined();

    for (const icon of [icon192, icon512, iconMaskable]) {
      if (icon) {
        const iconRes = await page.request.get(icon.src.startsWith('/') ? icon.src : `/${icon.src}`);
        expect(iconRes.status()).toBe(200);
        expect(iconRes.headers()['content-type'] ?? '').toContain('image/png');
      }
    }
    errors.assertNoErrors();
  });

  test('F25.5: /favicon.svg and /apple-touch-icon.png resolve HTTP 200 with expected content types', async ({
    page,
  }) => {
    const svgRes = await page.request.get('/favicon.svg');
    expect(svgRes.status()).toBe(200);
    expect(svgRes.headers()['content-type'] ?? '').toContain('svg');

    const appleRes = await page.request.get('/apple-touch-icon.png');
    expect(appleRes.status()).toBe(200);
    expect(appleRes.headers()['content-type'] ?? '').toContain('image/png');
    errors.assertNoErrors();
  });
});

test.describe('F26 — Service Worker Caching, Update Prompt & Exclusions', () => {
  test('F26.1: Service Worker registers cleanly in Chromium preview environment', async ({
    page,
  }) => {
    const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(swSupported).toBe(true);

    const swRes = await page.request.get('/sw.js');
    expect(swRes.status()).toBe(200);

    const regState = await page.evaluate(async () => {
      const reg = await Promise.race([
        navigator.serviceWorker.ready.then((r) => ({
          active: Boolean(r.active),
          scope: r.scope,
        })),
        new Promise<{ active: boolean; scope: string }>((resolve) =>
          window.setTimeout(() => resolve({ active: false, scope: '' }), 5000),
        ),
      ]);
      return reg;
    });
    expect(regState.active).toBe(true);
    errors.assertNoErrors();
  });

  test('F26.2: /sw.js never configures caching strategies for antigravity.google.com or accounts.google.com', async ({
    page,
  }) => {
    const swRes = await page.request.get('/sw.js');
    expect(swRes.status()).toBe(200);
    const swText = await swRes.text();

    // Positive Workbox NetworkOnly exclusions (registerRoute puts pattern before strategy).
    expect(swText).toMatch(/antigravity\\\.google[\s\S]{0,120}NetworkOnly/i);
    expect(swText).toMatch(/google\\\.com[\s\S]{0,120}NetworkOnly/i);
    expect(swText).toMatch(/auth\|oauth[\s\S]{0,120}NetworkOnly/i);

    // NavigateFallback denylist must exclude auth/oauth/token endpoints.
    expect(swText).toMatch(/denylist:[\s\S]*(?:\\\/|\/)auth/i);
    expect(swText).toMatch(/denylist:[\s\S]*(?:\\\/|\/)oauth/i);
    expect(swText).toMatch(/denylist:[\s\S]*(?:\\\/|\/)token/i);

    // Prompt update mode: skipWaiting only on explicit SKIP_WAITING message, never unconditionally on install.
    expect(swText).not.toMatch(/addEventListener\(\s*["']install["'][\s\S]{0,150}skipWaiting/i);
    expect(swText).toMatch(/SKIP_WAITING[\s\S]{0,60}skipWaiting/i);

    // Never pair caching strategies with Antigravity/Google origins in either order.
    expect(swText).not.toMatch(
      /(?:CacheFirst|NetworkFirst|StaleWhileRevalidate|CacheOnly)[\s\S]{0,120}(?:antigravity\\?\.google|accounts\\?\.google|google\\?\.com)/i,
    );
    expect(swText).not.toMatch(
      /(?:antigravity\\?\.google|accounts\\?\.google|google\\?\.com)[\s\S]{0,120}(?:CacheFirst|NetworkFirst|StaleWhileRevalidate|CacheOnly)/i,
    );
    errors.assertNoErrors();
  });

  test('F26.3: static /offline.html fallback page resolves HTTP 200 with offline explanation', async ({
    page,
  }) => {
    const res = await page.request.get('/offline.html');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/offline/i);
    expect(html).toMatch(/ag pocket/i);
    errors.assertNoErrors();
  });

  test('F26.4: app reloads cleanly under active Service Worker with zero console or page errors', async ({
    page,
  }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expectHeading(page, /ag pocket/i);
    errors.assertNoErrors();
  });

  test('F26.5: Settings or shell displays PWA/offline readiness cleanly without forced reload disruption', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await expectHeading(page, /settings/i);
    await expect(page.locator('main')).toContainText('Install AG Pocket (PWA)');
    await expect(page.locator('main')).toContainText(/Browser Tab|Installed \(Standalone\)/);
    await expect(
      page.getByRole('region', { name: /application update available/i }),
    ).toHaveCount(0);

    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await Promise.race([
        navigator.serviceWorker.ready.then((r) => Boolean(r.active)),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 5000)),
      ]);
      return reg;
    });
    expect(swReady).toBe(true);
    errors.assertNoErrors();
  });
});

test.describe('F27 — Platform Install Guides & Offline Banner', () => {
  test('F27.1: Android Chrome/Edge PWA installation instructions are visible in Setup or Settings', async ({
    page,
  }) => {
    await page.goto(ROUTES.settings, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main').getByText(/android \(chrome/i)).toBeVisible();
    await expect(page.locator('main').getByText(/install app/i).first()).toBeVisible();
    errors.assertNoErrors();
  });

  test('F27.2: iOS Safari Add to Home Screen standalone installation guide is visible', async ({
    page,
  }) => {
    await page.goto(ROUTES.settings, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main').getByText(/ios \(safari\)/i)).toBeVisible();
    await expect(page.locator('main').getByText(/add to home screen/i).first()).toBeVisible();
    errors.assertNoErrors();
  });

  test('F27.3: toggling context offline displays a visible offline banner', async ({
    page,
    context,
  }) => {
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('body')).toContainText(/offline/i);
    } finally {
      await context.setOffline(false);
    }
    errors.assertNoErrors();
  });

  test('F27.4: offline banner explains Remote Control requires internet while local modules stay usable', async ({
    page,
    context,
  }) => {
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      const offlineBanner = page.getByRole('status').filter({ hasText: /you are offline/i });
      await expect(offlineBanner).toBeVisible();
      await expect(offlineBanner).toContainText(/work offline/i);
      await expect(offlineBanner).toContainText(
        /antigravity\.google\.com.*requires an internet connection/i,
      );
    } finally {
      await context.setOffline(false);
    }
    errors.assertNoErrors();
  });

  test('F27.5: restoring online status dismisses the offline banner cleanly', async ({
    page,
    context,
  }) => {
    try {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('body')).toContainText(/you are offline|offline mode/i);
    } finally {
      await context.setOffline(false);
    }
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('body')).not.toContainText(/you are offline|offline mode/i);
    errors.assertNoErrors();
  });
});

test.describe('F28 — Dexie Typed Versioned Schema & Persistence', () => {
  test('F28.1: IndexedDB ag-pocket-db initializes with all 8 expected object stores', async ({
    page,
  }) => {
    const stores = await page.evaluate(
      (dbName) =>
        new Promise<string[]>((resolve, reject) => {
          const req = window.indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            const names = Array.from(db.objectStoreNames);
            db.close();
            resolve(names);
          };
          req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
        }),
      DEXIE_DB_NAME,
    );

    for (const expectedStore of EXPECTED_DEXIE_STORES) {
      expect(stores, `Missing Dexie object store: ${expectedStore}`).toContain(expectedStore);
    }
    errors.assertNoErrors();
  });

  test('F28.2: first-run starter prompts (12) and starter skills (9) seed idempotently across reloads', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByRole('button', { name: /^templates$/i }).click();
    const templates = page.getByRole('dialog', { name: /prompt templates/i });
    for (const title of STARTER_PROMPT_TITLES) {
      await expect(templates).toContainText(title);
    }
    await expect(templates.getByRole('heading', { level: 3, name: 'Build a New Feature' })).toHaveCount(1);
    await expect(templates.getByRole('heading', { level: 3 })).toHaveCount(STARTER_PROMPT_TITLES.length);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^templates$/i }).click();
    const reopened = page.getByRole('dialog', { name: /prompt templates/i });
    await expect(reopened.getByRole('heading', { level: 3 })).toHaveCount(STARTER_PROMPT_TITLES.length);
    await page.keyboard.press('Escape');
    await expect(reopened).toBeHidden();

    await navigatePrimaryTab(page, 'Skills');
    for (const skill of STARTER_SKILL_NAMES) {
      await expect(page.locator('main')).toContainText(skill);
    }
    errors.assertNoErrors();
  });

  test('F28.3: Settings preferences persist in IndexedDB across full page reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const toggle = page
      .getByRole('switch', { name: /reduced motion|reduce motion/i })
      .or(page.getByRole('checkbox', { name: /reduced motion|reduce motion/i }))
      .first();
    const initial = await toggle.isChecked();
    await toggle.click();
    await expect(toggle).toBeChecked({ checked: !initial });
    await expect.poll(async () => (await readSettingsRecord(page))?.reducedMotion).toBe(!initial);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(toggle).toBeChecked({ checked: !initial });
    errors.assertNoErrors();
  });

  test('F28.4: Prompt Studio active draft autosaves to IndexedDB and survives reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    const editor = page.getByLabel('Prompt', { exact: true });
    const draftContent = 'Persistent autosave prompt draft E2E-M1';
    await editor.fill(draftContent);

    await expect
      .poll(async () =>
        page.evaluate(
          (dbName) =>
            new Promise<string | null>((resolve) => {
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
                  const rec = req.result as { body?: string } | undefined;
                  resolve(rec?.body ?? null);
                };
                req.onerror = () => {
                  idb.close();
                  resolve(null);
                };
              };
            }),
          DEXIE_DB_NAME,
        ),
      )
      .toBe(draftContent);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue(draftContent);
    errors.assertNoErrors();
  });

  test('F28.5: created project persists in IndexedDB across full page reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page
      .getByRole('button', { name: /^new project$/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('IndexedDB Persisted Repo');
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('main')).toContainText('IndexedDB Persisted Repo');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('IndexedDB Persisted Repo');
    errors.assertNoErrors();
  });
});

test.describe('F29 — JSON Export/Import, Duplicate Prevention, Clear All & Privacy', () => {
  test('F29.1: Export JSON generates a downloadable valid JSON backup containing user data', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page
      .getByRole('button', { name: /^new project$/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Exportable Project');
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/i);

    const exportedText = await getLatestExportedText(page);
    expect(exportedText).toContain('Exportable Project');
    const parsed = JSON.parse(exportedText) as Record<string, unknown>;
    expect(typeof parsed).toBe('object');
    errors.assertNoErrors();
  });

  test('F29.2: Import JSON restores exported user records into a clean database across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page
      .getByRole('button', { name: /^new project$/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Restored Backup Project');
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export/i }).first().click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(10);
    const backupJson = await getLatestExportedText(page);

    await resetAppState(page);
    await navigatePrimaryTab(page, 'Settings');

    const fileInput = page.getByLabel('Import local data JSON file');
    await setJsonInputFile(fileInput, 'ag-pocket-backup.json', backupJson);
    const importSummary = page.getByRole('status').filter({ hasText: /import summary/i });
    await expect(importSummary).toBeVisible();
    await expect(importSummary).toContainText(/imported:\s*1 projects/i);

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Restored Backup Project');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText('Restored Backup Project');
    errors.assertNoErrors();
  });

  test('F29.3: re-importing the same JSON backup avoids creating duplicate project entries', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page
      .getByRole('button', { name: /^new project$/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Dedupe Unique Project');
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export/i }).first().click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(10);
    const backupJson = await getLatestExportedText(page);

    const fileInput = page.getByLabel('Import local data JSON file');
    await setJsonInputFile(fileInput, 'ag-pocket-backup.json', backupJson);
    const importSummary = page.getByRole('status').filter({ hasText: /import summary/i });
    await expect(importSummary).toBeVisible();
    await expect(importSummary).toContainText(/imported:\s*0 projects/i);
    await expect(importSummary).toContainText(/skipped duplicates:\s*1 projects/i);

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.getByText('Dedupe Unique Project', { exact: false })).toHaveCount(1);
    errors.assertNoErrors();
  });

  test('F29.4: Clear All Local Data requires two-step confirmation and canceling preserves data', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page
      .getByRole('button', { name: /^new project$/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Keep Me Project');
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /clear all local data/i }).click();

    const clearDialog = page.getByRole('dialog', { name: /clear all local data/i });
    await expect(clearDialog).toBeVisible();
    const cancelBtn = clearDialog.getByRole('button', { name: /^cancel$/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(clearDialog).toBeHidden();

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).toContainText('Keep Me Project');
    errors.assertNoErrors();
  });

  test('F29.5: confirming two-step Clear All Local Data deletes user-created records across reload', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Projects');
    await page
      .getByRole('button', { name: /^new project$/i })
      .first()
      .click();
    await page.getByRole('dialog').getByLabel(/^title$/i).fill('Delete Me Project');
    await page.getByRole('dialog').getByRole('button', { name: /^(create project|save changes)$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /clear all local data/i }).click();

    const clearDialog = page.getByRole('dialog', { name: /clear all local data/i });
    await expect(clearDialog).toBeVisible();
    const confirmBtn = clearDialog.getByRole('button', { name: /confirm clear all data/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await expect(clearDialog).toBeHidden();

    await navigatePrimaryTab(page, 'Projects');
    await expect(page.locator('main')).not.toContainText('Delete Me Project');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).not.toContainText('Delete Me Project');
    errors.assertNoErrors();
  });

  test('F29.6: /privacy page discloses local IndexedDB storage, zero backend, and zero OAuth/cookies', async ({
    page,
  }) => {
    await page.goto(ROUTES.privacy, { waitUntil: 'domcontentloaded' });
    await expectHeading(page, /privacy/i);
    const text = await page.locator('main').innerText();
    expect(text).toMatch(/indexeddb|local/i);
    expect(text).toMatch(/no backend|zero backend|client-side/i);
    expect(text).toMatch(/oauth|cookies|credentials/i);
    errors.assertNoErrors();
  });
});

test.describe('F30 — Official Integration Boundary & Docs Consistency', () => {
  test('F30.1: Home, Setup Center, and Privacy consistently reference https://antigravity.google.com', async ({
    page,
  }) => {
    for (const route of [ROUTES.home, ROUTES.setup, ROUTES.privacy]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toContainText(/antigravity\.google\.com/i);
    }
    errors.assertNoErrors();
  });

  test('F30.2: all external documentation links stay strictly under https://antigravity.google/docs/', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="http"]')).map(
        (a) => a.getAttribute('href') ?? '',
      ),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      let parsed: URL | null;
      try {
        parsed = new URL(href);
      } catch {
        parsed = null;
      }
      expect(parsed, `Invalid external URL found: ${href}`).not.toBeNull();
      if (parsed) {
        const isOfficialBase =
          parsed.origin === 'https://antigravity.google.com' && parsed.pathname === '/';
        const isOfficialDocs =
          parsed.origin === 'https://antigravity.google' &&
          parsed.pathname.startsWith('/docs/');
        expect(isOfficialBase || isOfficialDocs, `Unexpected external link found: ${href}`).toBe(
          true,
        );
      }
    }
    const docsLinks = hrefs.filter((href) => {
      try {
        const parsed = new URL(href);
        return (
          parsed.origin === 'https://antigravity.google' && parsed.pathname.startsWith('/docs/')
        );
      } catch {
        return false;
      }
    });
    expect(docsLinks.length).toBeGreaterThanOrEqual(3);
    errors.assertNoErrors();
  });

  test('F30.3: Settings and Privacy disclose official companion boundary and non-affiliation', async ({
    page,
  }) => {
    await page.goto(ROUTES.privacy, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText(/companion|official|antigravity/i);
    await navigatePrimaryTab(page, 'Settings');
    await expect(page.locator('main')).toContainText(/privacy|official|companion/i);
    errors.assertNoErrors();
  });

  test('F30.4: Prompt Studio copy/open actions clarify copying locally without automated submission', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Prompts');
    await expect(page.getByText(/nothing is sent anywhere/i)).toBeVisible();
    await page.getByLabel('Prompt', { exact: true }).fill('Plan a refactor of the settings module');
    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await expect(page.getByRole('button', { name: /open antigravity/i })).toBeVisible();
    await expect(page.getByText(/never submits prompts/i)).toBeVisible();
    errors.assertNoErrors();
  });

  test('F30.5: Settings Privacy navigation link routes cleanly to /privacy', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    const privacyControl = page
      .locator('main')
      .getByRole('link', { name: /privacy/i })
      .or(page.locator('main').getByRole('button', { name: /privacy/i }))
      .first();
    await expect(privacyControl).toBeVisible();
    await privacyControl.click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expectHeading(page, /privacy/i);
    errors.assertNoErrors();
  });
});
