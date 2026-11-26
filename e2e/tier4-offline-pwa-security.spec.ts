import { expect, test } from '@playwright/test';
import {
  assertZeroForbiddenDomAndStorage,
  attachErrorListeners,
  attachSecurityNetworkGuard,
  createProjectViaUi,
  createSkillViaUi,
  createTaskViaUi,
  createWorkflowViaUi,
  DEXIE_DB_NAME,
  ensureServiceWorkerReady,
  EXPECTED_DEXIE_STORES,
  expectHeading,
  getLatestExportedText,
  installClipboardSpy,
  installExportSpy,
  installWindowOpenSpy,
  MANIFEST_CONTRACT,
  navigateDrawerRoute,
  navigatePrimaryTab,
  OFFICIAL_URLS,
  openNavDrawer,
  resetAppState,
  ROUTES,
  setJsonInputFile,
  triggerAndVerifyOfficialUrl,
  type ErrorCollector,
  type SecurityNetworkGuard,
} from './helpers/app';

let errors: ErrorCollector;
let networkGuard: SecurityNetworkGuard;

const ALL_APP_ROUTES = [
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

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } {
  expect(bytes.length).toBeGreaterThanOrEqual(24);
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSignature.length; i++) {
    expect(bytes[i], `Invalid PNG signature byte at ${i}`).toBe(pngSignature[i]);
  }
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  expect(chunkType).toBe('IHDR');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

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
  if (test.info().title.includes('P13')) {
    errors.assertNoPageErrors();
  } else {
    errors.assertNoErrors();
  }
});

test.describe('Tier 4 — PWA Manifest, Icons & Binary Integrity (F25)', () => {
  test('P1: /manifest.webmanifest link and JSON match full R5 Web App Manifest contract', async ({
    page,
  }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/manifest.webmanifest');

    const res = await page.request.get(manifestHref!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type'] ?? '').toMatch(/json/i);

    const manifest = (await res.json()) as {
      name?: string;
      short_name?: string;
      display?: string;
      orientation?: string;
      start_url?: string;
      scope?: string;
      theme_color?: string;
      background_color?: string;
      icons?: Array<{ src: string; sizes?: string; type?: string; purpose?: string }>;
    };

    expect(manifest.name).toBe(MANIFEST_CONTRACT.name);
    expect(manifest.short_name).toBe(MANIFEST_CONTRACT.short_name);
    expect(manifest.display).toBe(MANIFEST_CONTRACT.display);
    expect(manifest.orientation).toBe(MANIFEST_CONTRACT.orientation);
    expect(manifest.start_url).toBe(MANIFEST_CONTRACT.start_url);
    expect(manifest.scope).toBe(MANIFEST_CONTRACT.scope);
    expect(manifest.theme_color?.toLowerCase()).toBe('#000000');
    expect(manifest.background_color?.toLowerCase()).toBe('#000000');
    expect((manifest.icons ?? []).length).toBeGreaterThanOrEqual(3);
  });

  test('P2: PWA icons (192x192, 512x512, maskable 512x512) and apple-touch-icon (180x180) serve valid PNG binaries with exact IHDR dimensions', async ({
    page,
  }) => {
    const expectedIcons = [
      { path: '/pwa-192x192.png', width: 192, height: 192 },
      { path: '/pwa-512x512.png', width: 512, height: 512 },
      { path: '/pwa-512x512-maskable.png', width: 512, height: 512 },
      { path: '/apple-touch-icon.png', width: 180, height: 180 },
    ];

    for (const icon of expectedIcons) {
      const res = await page.request.get(icon.path);
      expect(res.status(), `Failed to fetch ${icon.path}`).toBe(200);
      expect(res.headers()['content-type'] ?? '').toContain('image/png');
      const body = await res.body();
      const dims = parsePngDimensions(body);
      expect(dims, `Unexpected PNG dimensions for ${icon.path}`).toEqual({
        width: icon.width,
        height: icon.height,
      });
    }
  });

  test('P3: /favicon.svg resolves HTTP 200 as valid SVG markup', async ({ page }) => {
    const res = await page.request.get('/favicon.svg');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type'] ?? '').toContain('svg');
    const svgText = await res.text();
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('</svg>');
  });

  test('P4: Apple standalone PWA meta tags and dynamic theme-color meta stay synchronized', async ({
    page,
  }) => {
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes',
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
    ).toHaveAttribute('content', 'black-translucent');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
      'content',
      'AG Pocket',
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');

    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /^light$/i }).click();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f8fafc');
  });
});

test.describe('Tier 4 — Service Worker Registration, Precache & Update Contract (F26)', () => {
  test('P5: Service Worker activates and controls root scope', async ({ page }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    const swDetails = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return {
        hasController: Boolean(navigator.serviceWorker.controller),
        activeState: reg.active?.state ?? '',
        scope: reg.scope,
      };
    });

    expect(swDetails.hasController).toBe(true);
    expect(swDetails.activeState).toBe('activated');
    expect(new URL(swDetails.scope).pathname).toBe('/');
  });

  test('P6: Workbox precache caches app shell & offline.html while storing zero Google/Antigravity/auth URLs', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    const cacheEntries = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const req of requests) {
          urls.push(req.url);
        }
      }
      return { names, urls };
    });

    expect(cacheEntries.names.length).toBeGreaterThan(0);
    expect(cacheEntries.urls.some((u) => u.includes('/offline.html'))).toBe(true);
    expect(cacheEntries.urls.some((u) => u.includes('/index.html'))).toBe(true);

    for (const url of cacheEntries.urls) {
      expect(url).not.toMatch(
        /antigravity\.google|accounts\.google|google\.com|\/oauth|\/token|\/auth\/|\/login|\/signin|\/session/i,
      );
    }
  });

  test('P7: /sw.js enforces registerType=prompt SKIP_WAITING contract, NetworkOnly rules, and navigateFallbackDenylist', async ({
    page,
  }) => {
    const swRes = await page.request.get('/sw.js');
    expect(swRes.status()).toBe(200);
    const swText = await swRes.text();

    // Prompt update contract: SKIP_WAITING via message, never unconditional skipWaiting inside install
    expect(swText).toMatch(/SKIP_WAITING[\s\S]{0,80}skipWaiting/i);
    expect(swText).not.toMatch(/addEventListener\(\s*["']install["'][\s\S]{0,150}skipWaiting/i);

    // NetworkOnly rules for Google / Antigravity / Auth routes
    expect(swText).toMatch(/antigravity\\\.google[\s\S]{0,120}NetworkOnly/i);
    expect(swText).toMatch(/google\\\.com[\s\S]{0,120}NetworkOnly/i);
    expect(swText).toMatch(/auth\|oauth[\s\S]{0,120}NetworkOnly/i);

    // NavigateFallback denylist blocks auth/api/static routes
    for (const seg of ['api', 'auth', 'oauth', 'login', 'signin', 'session', 'token', 'offline']) {
      expect(swText).toMatch(new RegExp(`denylist:[\\s\\S]*${seg}`, 'i'));
    }
  });

  test('P8: normal boot displays no spurious SW update banner and Settings exposes Android/iOS install guides', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);
    await expect(
      page.getByRole('region', { name: /application update available/i }),
    ).toHaveCount(0);

    await navigatePrimaryTab(page, 'Settings');
    const main = page.locator('main');
    await expect(main).toContainText('Install AG Pocket (PWA)');
    await expect(main).toContainText('Android (Chrome / Edge)');
    await expect(main).toContainText('iOS (Safari)');
  });
});

test.describe('Tier 4 — Offline Shell, Multi-Route Reloads & Denylist Enforcement (F26, F27, F28)', () => {
  test('P9: under active SW offline, reloading / renders Home shell, Offline badge, and global offline banner', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    try {
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expectHeading(page, /ag pocket command center/i);
      await expect(page.locator('header')).toContainText('Offline');

      const offlineBanner = page.getByRole('status').filter({ hasText: /you are offline/i });
      await expect(offlineBanner).toBeVisible();
      await expect(offlineBanner).toContainText(
        /remote control.*antigravity\.google\.com.*requires an internet connection/i,
      );
    } finally {
      await context.setOffline(false);
    }
  });

  test('P10: under active SW offline, direct navigation across all 10 routes resolves cleanly with offline banner', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    try {
      await context.setOffline(true);
      for (const route of ALL_APP_ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: /you are offline/i })).toBeVisible();
      }
    } finally {
      await context.setOffline(false);
    }
  });

  test('P11: offline CRUD (Project, Task, Prompt Draft) persists across offline reload and recovers online', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    try {
      await context.setOffline(true);
      await createProjectViaUi(page, { title: 'Offline PWA Project', pinned: true });
      await createTaskViaUi(page, {
        title: 'Offline PWA Task',
        project: 'Offline PWA Project',
        status: 'Planned',
      });
      await navigatePrimaryTab(page, 'Prompts');
      await page.getByLabel(/^title$/i).fill('Offline PWA Draft');
      await page.getByLabel('Prompt', { exact: true }).fill('Draft saved offline.');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByLabel(/^title$/i)).toHaveValue('Offline PWA Draft');
      await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Draft saved offline.');

      await navigatePrimaryTab(page, 'Projects');
      await expect(page.getByRole('link', { name: 'Offline PWA Project' })).toBeVisible();

      await navigateDrawerRoute(page, /task board/i);
      await expect(page.getByTestId('task-card').filter({ hasText: 'Offline PWA Task' })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    await expect(page.locator('header')).toContainText('Online');
    await expect(page.getByRole('status').filter({ hasText: /you are offline/i })).toHaveCount(0);
    await navigatePrimaryTab(page, 'Home');
    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('button', { name: /^open antigravity$/i }).first(),
      OFFICIAL_URLS.base,
    );
  });

  test('P12: /offline.html static fallback page contains zero <script> tags, offline notice, and Return link', async ({
    page,
  }) => {
    const res = await page.request.get('/offline.html');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toMatch(/you are offline/i);
    expect(html).toContain('https://antigravity.google.com');

    await page.goto('/offline.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('script')).toHaveCount(0);
    const returnLink = page.getByRole('link', { name: /return to ag pocket/i });
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveAttribute('href', '/');
  });

  test('P13: under active SW offline, navigateFallbackDenylist blocks /oauth/*, /token, /auth/*, /login, /signin, /session, /api/*', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await ensureServiceWorkerReady(page);

    try {
      await context.setOffline(true);
      const blockedPaths = [
        '/oauth/callback',
        '/token',
        '/auth/google',
        '/login',
        '/signin',
        '/session',
        '/api/health',
      ];
      for (const path of blockedPaths) {
        const result = await page.evaluate(async (targetPath) => {
          try {
            const resp = await fetch(targetPath);
            return `STATUS:${resp.status}`;
          } catch {
            return 'NETWORK_REJECTED';
          }
        }, path);
        expect(result, `Expected ${path} to reject offline rather than fall back`).toBe(
          'NETWORK_REJECTED',
        );
      }
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe('Tier 4 — Exhaustive R2 Security Boundary Audit (F3, F4, F5, F6)', () => {
  test('P14: zero <iframe>, zero WebSockets, and zero outbound requests across all routes and CRUD operations', async ({
    page,
  }) => {
    await createProjectViaUi(page, {
      title: 'Security Audit Repo',
      officialUrl: 'https://antigravity.google.com/r/sec-audit',
      pinned: true,
    });
    await createSkillViaUi(page, {
      name: 'Security Audit Skill',
      instructions: 'Inspect boundaries.',
    });
    await createWorkflowViaUi(page, {
      title: 'Security Audit Flow',
      steps: ['Verify zero external requests'],
    });
    await createTaskViaUi(page, {
      title: 'Security Audit Task',
      project: 'Security Audit Repo',
    });

    for (const route of ALL_APP_ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('iframe')).toHaveCount(0);
    }
    expect(networkGuard.websockets).toEqual([]);
    networkGuard.assertClean();
  });

  test('P15: Web Storage, cookies, and all 8 IndexedDB stores contain zero OAuth keys, credentials, or ya29.* tokens', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Storage Audit Repo' });
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Local prompt draft');
    await createTaskViaUi(page, { title: 'Storage Audit Task', project: 'Storage Audit Repo' });

    await assertZeroForbiddenDomAndStorage(page);

    const idbDump = await page.evaluate(
      ({ dbName, stores }) =>
        new Promise<string>((resolve, reject) => {
          const req = window.indexedDB.open(dbName);
          req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction([...stores], 'readonly');
            const out: Record<string, unknown[]> = {};
            for (const store of stores) {
              const getAll = tx.objectStore(store).getAll();
              getAll.onsuccess = () => {
                out[store] = getAll.result as unknown[];
              };
            }
            tx.oncomplete = () => {
              db.close();
              resolve(JSON.stringify(out));
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error ?? new Error('IDB read failed'));
            };
          };
        }),
      { dbName: DEXIE_DB_NAME, stores: EXPECTED_DEXIE_STORES },
    );

    expect(idbDump).not.toMatch(/ya29\.[A-Za-z0-9_-]+/);
    expect(idbDump).not.toMatch(/"(?:access_token|refresh_token|id_token|SAPISID|APISID)"/i);
  });

  test('P16: OfficialIntegrationAdapter remains permanently disabled across Settings and Privacy', async ({
    page,
  }) => {
    await navigatePrimaryTab(page, 'Settings');
    await expect(page.locator('main')).toContainText('Official Integration Adapter');
    await expect(page.locator('main')).toContainText('Disabled');
    await expect(page.locator('main')).toContainText('official-antigravity-placeholder');

    await navigateDrawerRoute(page, /privacy/i);
    await expect(page.locator('main')).toContainText('Disabled Future Integration Adapter');
    await expect(page.locator('main')).toContainText('enabled: false');

    const forbiddenControls = page.getByRole('button', {
      name: /connect bridge|pair local server|start live stream|approve command/i,
    });
    await expect(forbiddenControls).toHaveCount(0);
  });

  test('P17: all external launches and doc anchors across Home, Project Detail, Prompt Studio, Drawer, and Setup target official Google Antigravity URLs', async ({
    page,
  }) => {
    const projectUrl = 'https://antigravity.google.com/r/boundary-check?p=1';
    await createProjectViaUi(page, { title: 'Official Link Repo', officialUrl: projectUrl });

    // Project Detail launch
    await page.getByRole('link', { name: 'Official Link Repo' }).click();
    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('button', { name: /open project in antigravity/i }),
      projectUrl,
    );

    // Prompt Studio post-copy launch
    await navigatePrimaryTab(page, 'Prompts');
    await page.getByLabel('Prompt', { exact: true }).fill('Test post-copy launch');
    await page.getByRole('button', { name: /^copy prompt$/i }).click();
    await triggerAndVerifyOfficialUrl(
      page,
      page.locator('main').getByRole('button', { name: /^open antigravity$/i }),
      OFFICIAL_URLS.base,
    );

    // Nav Drawer launch
    await openNavDrawer(page);
    await triggerAndVerifyOfficialUrl(
      page,
      page.getByRole('dialog', { name: /navigation menu/i }).getByRole('button', {
        name: /^open antigravity$/i,
      }),
      OFFICIAL_URLS.base,
    );

    // Setup Center anchors
    await navigateDrawerRoute(page, /connection setup center/i);
    const anchors = page.locator('main a[href]');
    const count = await anchors.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i++) {
      const href = (await anchors.nth(i).getAttribute('href')) ?? '';
      if (href.startsWith('http')) {
        expect(
          href === OFFICIAL_URLS.base || href.startsWith(OFFICIAL_URLS.docsPrefix),
          `Unexpected external anchor: ${href}`,
        ).toBe(true);
        await expect(anchors.nth(i)).toHaveAttribute('target', '_blank');
        const rel = ((await anchors.nth(i).getAttribute('rel')) ?? '').toLowerCase();
        expect(rel).toContain('noopener');
        expect(rel).toContain('noreferrer');
      }
    }
  });

  test('P18: JSON export/import and malicious JSON rejection execute locally with zero XSS or network leaks', async ({
    page,
  }) => {
    await createProjectViaUi(page, { title: 'Clean Export Repo' });
    await navigatePrimaryTab(page, 'Settings');
    await page.getByRole('button', { name: /export local data \(json\)/i }).click();
    await expect.poll(async () => (await getLatestExportedText(page)).length).toBeGreaterThan(20);
    const validBundle = JSON.parse(await getLatestExportedText(page)) as {
      schemaVersion: number;
      app: string;
      exportedAt: string;
      data: Record<string, unknown[]>;
    };

    const evilBundle = {
      ...validBundle,
      data: {
        ...validBundle.data,
        projects: [
          {
            id: 'evil-proj',
            title: '<img src=x onerror="window.__xssTriggered=true">',
            category: 'Other',
            machineName: '',
            workspaceLabel: '',
            officialUrl: 'javascript:alert(1)',
            description: '',
            notes: '',
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    };

    await setJsonInputFile(
      page.getByLabel('Import local data JSON file'),
      'evil.json',
      JSON.stringify(evilBundle),
    );
    await expect(page.getByRole('alert').filter({ hasText: /import rejected/i })).toBeVisible();
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    networkGuard.assertClean();
  });

  test('P19: static PWA endpoints never fall back to SPA HTML and unknown wildcard routes safely redirect to /', async ({
    page,
  }) => {
    const manifestRes = await page.request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    expect(await manifestRes.text()).not.toContain('<!doctype html>');

    const swRes = await page.request.get('/sw.js');
    expect(swRes.status()).toBe(200);
    expect(await swRes.text()).not.toContain('<!doctype html>');

    await page.goto('/nonexistent-pwa-route/nested', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/$/);
    await expectHeading(page, /ag pocket command center/i);
    await assertZeroForbiddenDomAndStorage(page);
  });
});
