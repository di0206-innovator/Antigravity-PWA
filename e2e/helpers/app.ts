import { expect, type Locator, type Page, type Request } from '@playwright/test';

export const OFFICIAL_URLS = {
  base: 'https://antigravity.google.com',
  docsRemoteControl: 'https://antigravity.google/docs/remote-control',
  docsRemoteAgents: 'https://antigravity.google/docs/remote-agents',
  docsFaq: 'https://antigravity.google/docs/faq',
  docsPrefix: 'https://antigravity.google/docs/',
} as const;

export const ROUTES = {
  home: '/',
  setup: '/setup',
  projects: '/projects',
  projectDetail: (id: string) => `/projects/${id}`,
  prompts: '/prompts',
  skills: '/skills',
  workflows: '/workflows',
  tasks: '/tasks',
  activity: '/activity',
  settings: '/settings',
  privacy: '/privacy',
} as const;

export const VIEWPORT_WIDTHS = [320, 360, 375, 390, 393, 430, 768, 1024, 1440] as const;

export const PRIMARY_NAV_LABELS = ['Home', 'Projects', 'Prompts', 'Skills', 'Settings'] as const;
export type PrimaryNavLabel = (typeof PRIMARY_NAV_LABELS)[number];

export const PRIMARY_NAV_ROUTES: Record<PrimaryNavLabel, string> = {
  Home: ROUTES.home,
  Projects: ROUTES.projects,
  Prompts: ROUTES.prompts,
  Skills: ROUTES.skills,
  Settings: ROUTES.settings,
};

export const DRAWER_ROUTE_ITEMS = [
  { label: 'Workflow Library', pattern: /workflow/i, route: ROUTES.workflows },
  { label: 'Task Board', pattern: /task/i, route: ROUTES.tasks },
  { label: 'Activity', pattern: /activity/i, route: ROUTES.activity },
  { label: 'Connection Setup Center', pattern: /connection|setup/i, route: ROUTES.setup },
  { label: 'Privacy', pattern: /privacy/i, route: ROUTES.privacy },
] as const;

export const STARTER_PROMPT_TITLES = [
  'Build a New Feature',
  'Debug an Existing Issue',
  'Refactor Existing Code',
  'Audit a Codebase',
  'Design a Mobile-First Interface',
  'Implement a Backend Feature',
  'Perform a Security Review',
  'Write and Execute Tests',
  'Research a Technical Problem',
  'Prepare an Implementation Plan',
  'Review Git Changes',
  'Build a Complete Application in One Pass',
] as const;

export const PROMPT_VARIABLES = [
  '{{project_name}}',
  '{{task_description}}',
  '{{tech_stack}}',
  '{{requirements}}',
  '{{constraints}}',
  '{{skills_to_use}}',
] as const;

export const STARTER_SKILL_NAMES = [
  'Hallmark',
  'Teamwork',
  'Swarm',
  'Red Antigravity Skills',
  'Frontend Engineering',
  'UI/UX Design',
  'Code Review',
  'Testing and QA',
  'Security Review',
] as const;

export const PROJECT_CATEGORIES = [
  'AI / ML',
  'Web Development',
  'Mobile Development',
  'Backend',
  'Automation',
  'Research',
  'Experiments',
  'Other',
] as const;

export const SKILL_CATEGORIES = [
  'Frontend',
  'Backend',
  'Architecture',
  'AI Engineering',
  'Agent Orchestration',
  'Security',
  'Testing',
  'Design',
  'Productivity',
  'Custom',
] as const;

export const WORKFLOW_CATEGORIES = [
  'Development',
  'Frontend',
  'AI Engineering',
  'Release Engineering',
  'Custom',
] as const;

export const TASK_STATUSES = [
  'Backlog',
  'Planned',
  'In Progress',
  'Needs Attention',
  'Completed',
] as const;

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export const CONNECTION_READINESS_STATES = [
  'Not configured',
  'Setup instructions available',
  'Ready to open',
  'Remote connection not verified',
] as const;

export const HOME_QUICK_ACTIONS = [
  { label: 'New Prompt', route: ROUTES.prompts },
  { label: 'Open Antigravity', externalUrl: OFFICIAL_URLS.base },
  { label: 'New Project', route: ROUTES.projects },
  { label: 'Browse Skills', route: ROUTES.skills },
  { label: 'New Task Note', route: ROUTES.tasks },
  { label: 'View Workflow Library', route: ROUTES.workflows },
] as const;

export const CLI_REFERENCE_COMMANDS = [
  '/remote-control',
  'agy --remote-control',
  'agy remote-control start',
  'agy remote-control status',
  'agy remote-control stop',
] as const;

export const MANIFEST_CONTRACT = {
  name: 'AG Pocket — Antigravity Mobile Command Center',
  short_name: 'AG Pocket',
  display: 'standalone',
  orientation: 'any',
  start_url: '/',
  scope: '/',
} as const;

export const DEXIE_DB_NAME = 'ag-pocket-db';

export const EXPECTED_DEXIE_STORES = [
  'projects',
  'prompts',
  'skills',
  'workflows',
  'tasks',
  'activityLog',
  'settings',
  'promptDrafts',
] as const;

export interface OpenedUrlRecord {
  url: string;
  target?: string;
  features?: string;
}

export interface ThemeSnapshot {
  htmlClass: string;
  dataTheme: string | null;
  bodyBg: string;
  isDarkBg: boolean;
}

declare global {
  interface Window {
    __openedUrls?: OpenedUrlRecord[];
    __copiedTexts?: string[];
    __exportedBlobs?: Array<{ url: string; blob: Blob }>;
    __bootMarker?: string;
    __xssTriggered?: boolean;
  }
}

export async function resetAppState(
  page: Page,
  options?: { clearServiceWorkers?: boolean },
): Promise<void> {
  const clearSW = Boolean(options?.clearServiceWorkers);
  try {
    await page.goto('/favicon.svg', { waitUntil: 'domcontentloaded' });
  } catch {
    await page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });
  }

  await page.evaluate(
    async ({ dbName, shouldClearSW }) => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore storage errors on non-HTML documents if any
      }
      try {
        window.sessionStorage.clear();
      } catch {
        // ignore storage errors
      }

      const deleteDb = (name: string) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };
          const timer = window.setTimeout(done, 1500);
          try {
            const req = window.indexedDB.deleteDatabase(name);
            req.onsuccess = () => {
              window.clearTimeout(timer);
              done();
            };
            req.onerror = () => {
              window.clearTimeout(timer);
              done();
            };
            req.onblocked = () => {
              window.clearTimeout(timer);
              done();
            };
          } catch {
            window.clearTimeout(timer);
            done();
          }
        });

      const dbNames = new Set<string>([dbName]);
      if (typeof window.indexedDB.databases === 'function') {
        try {
          const list = await window.indexedDB.databases();
          for (const entry of list) {
            if (entry.name) {
              dbNames.add(entry.name);
            }
          }
        } catch {
          // ignore if databases() is restricted
        }
      }

      for (const name of dbNames) {
        await deleteDb(name);
      }

      if (shouldClearSW) {
        if ('caches' in window) {
          try {
            const keys = await window.caches.keys();
            await Promise.all(keys.map((key) => window.caches.delete(key)));
          } catch {
            // ignore cache clear failure
          }
        }
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((reg) => reg.unregister()));
          } catch {
            // ignore SW unregister failure
          }
        }
      }
    },
    { dbName: DEXIE_DB_NAME, shouldClearSW: clearSW },
  );

  await page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  // First-run seeding writes the default settings row last; wait so tests never race it.
  await expect.poll(() => readSettingsRecord(page)).not.toBeNull();
}

/** Reads the persisted Dexie settings row straight from IndexedDB (null until seeded). */
export async function readSettingsRecord(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    (dbName) =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        const open = window.indexedDB.open(dbName);
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const idb = open.result;
          if (!idb.objectStoreNames.contains('settings')) {
            idb.close();
            resolve(null);
            return;
          }
          const req = idb.transaction('settings', 'readonly').objectStore('settings').get('default');
          req.onsuccess = () => {
            idb.close();
            resolve((req.result as Record<string, unknown> | undefined) ?? null);
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

export async function installWindowOpenSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__openedUrls = [];
    window.open = (
      url?: string | URL,
      target?: string,
      features?: string,
    ): WindowProxy | null => {
      const list = window.__openedUrls ?? [];
      list.push({
        url: url ? String(url) : '',
        target: target ? String(target) : undefined,
        features: features ? String(features) : undefined,
      });
      window.__openedUrls = list;
      return null;
    };
  });
}

export async function getOpenedUrls(page: Page): Promise<OpenedUrlRecord[]> {
  return page.evaluate(() => window.__openedUrls ?? []);
}

function matchesExpectedUrl(actual: string, expected: string | RegExp): boolean {
  if (typeof expected === 'string') {
    try {
      const parsedActual = new URL(actual);
      const parsedExpected = new URL(expected);
      if (parsedActual.origin !== parsedExpected.origin) {
        return false;
      }
      if (parsedExpected.pathname !== '/') {
        if (parsedExpected.pathname.endsWith('/')) {
          return parsedActual.pathname.startsWith(parsedExpected.pathname);
        }
        return (
          parsedActual.pathname === parsedExpected.pathname &&
          parsedActual.search === parsedExpected.search &&
          parsedActual.hash === parsedExpected.hash
        );
      }
      return true;
    } catch {
      return false;
    }
  }
  return expected.test(actual);
}

export async function triggerAndVerifyOfficialUrl(
  page: Page,
  locator: Locator,
  expectedUrl: string | RegExp,
): Promise<void> {
  await expect(locator).toBeVisible();
  const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());

  if (tagName === 'a') {
    const attrs = await locator.evaluate((el) => ({
      href: el.getAttribute('href') ?? '',
      target: el.getAttribute('target') ?? '',
      rel: (el.getAttribute('rel') ?? '').toLowerCase(),
    }));
    expect(matchesExpectedUrl(attrs.href, expectedUrl)).toBe(true);
    expect(attrs.target).toBe('_blank');
    expect(attrs.rel).toContain('noopener');
    expect(attrs.rel).toContain('noreferrer');
    return;
  }

  const before = (await getOpenedUrls(page)).length;
  await locator.click();
  await expect
    .poll(async () => (await getOpenedUrls(page)).length, {
      message: 'Expected window.open to be invoked on official link click',
    })
    .toBeGreaterThan(before);

  const opened = await getOpenedUrls(page);
  const latest = opened[opened.length - 1];
  expect(latest).toBeDefined();
  expect(matchesExpectedUrl(latest.url, expectedUrl)).toBe(true);
  const features = (latest.features ?? '').toLowerCase();
  expect(features).toContain('noopener');
  expect(features).toContain('noreferrer');
}

export async function installClipboardSpy(page: Page): Promise<void> {
  await page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'])
    .catch(() => undefined);

  await page.addInitScript(() => {
    window.__copiedTexts = [];
    let buffer = '';
    const spyClipboard = {
      writeText: async (text: string): Promise<void> => {
        buffer = String(text);
        const list = window.__copiedTexts ?? [];
        list.push(buffer);
        window.__copiedTexts = list;
      },
      readText: async (): Promise<string> => buffer,
    };

    try {
      const existing = navigator.clipboard;
      if (existing) {
        try {
          Object.defineProperty(existing, 'writeText', {
            configurable: true,
            value: spyClipboard.writeText,
          });
          Object.defineProperty(existing, 'readText', {
            configurable: true,
            value: spyClipboard.readText,
          });
          return;
        } catch {
          // fallback to replacing navigator.clipboard
        }
      }
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get: () => spyClipboard,
      });
    } catch {
      // ignore if clipboard cannot be redefined in environment
    }
  });
}

export async function getCopiedTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__copiedTexts ?? []);
}

export interface ErrorCollector {
  pageErrors: string[];
  consoleErrors: string[];
  assertNoErrors: () => void;
  assertNoPageErrors: () => void;
}

export function attachErrorListeners(page: Page): ErrorCollector {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  return {
    pageErrors,
    consoleErrors,
    assertNoErrors: () => {
      expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
      expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    },
    assertNoPageErrors: () => {
      expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    },
  };
}

export interface SecurityNetworkGuard {
  violations: string[];
  websockets: string[];
  allRequests: string[];
  assertClean: () => void;
}

function isAllowedLocalOrDataUrl(rawUrl: string): boolean {
  if (
    rawUrl.startsWith('data:') ||
    rawUrl.startsWith('blob:') ||
    rawUrl.startsWith('about:') ||
    rawUrl.startsWith('chrome-extension:')
  ) {
    return true;
  }
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function attachSecurityNetworkGuard(page: Page): SecurityNetworkGuard {
  const violations: string[] = [];
  const websockets: string[] = [];
  const allRequests: string[] = [];
  const seenRequests = new WeakSet<Request>();

  const recordRequest = (request: Request) => {
    if (seenRequests.has(request)) {
      return;
    }
    seenRequests.add(request);
    const url = request.url();
    allRequests.push(url);
    if (!isAllowedLocalOrDataUrl(url)) {
      violations.push(url);
    }
  };

  page.on('request', recordRequest);
  page.context().on('request', recordRequest);

  page.on('websocket', (ws) => {
    websockets.push(ws.url());
  });

  return {
    violations,
    websockets,
    allRequests,
    assertClean: () => {
      expect(
        violations,
        `Forbidden external network requests detected: ${violations.join(', ')}`,
      ).toEqual([]);
      expect(
        websockets,
        `Forbidden WebSocket connections detected: ${websockets.join(', ')}`,
      ).toEqual([]);
    },
  };
}

const FORBIDDEN_CREDENTIAL_KEY_PATTERNS = [
  /access_token/i,
  /refresh_token/i,
  /id_token/i,
  /oauth/i,
  /^SAPISID$/i,
  /^APISID$/i,
  /^HSID$/i,
  /^SID$/i,
  /^__Secure-1PSID$/i,
  /^__Secure-3PSID$/i,
];

export async function assertZeroForbiddenDomAndStorage(page: Page): Promise<void> {
  const iframeCount = await page.locator('iframe').count();
  expect(iframeCount, 'Zero <iframe> elements allowed by R2 boundary').toBe(0);

  const storageAudit = await page.evaluate(() => {
    const localKeys = Object.keys(window.localStorage);
    const sessionKeys = Object.keys(window.sessionStorage);
    const localDump = localKeys.map((k) => `${k}=${window.localStorage.getItem(k) ?? ''}`);
    const sessionDump = sessionKeys.map((k) => `${k}=${window.sessionStorage.getItem(k) ?? ''}`);
    return { localKeys, sessionKeys, localDump, sessionDump };
  });

  for (const key of [...storageAudit.localKeys, ...storageAudit.sessionKeys]) {
    for (const pattern of FORBIDDEN_CREDENTIAL_KEY_PATTERNS) {
      expect(pattern.test(key), `Forbidden auth key found in Web Storage: ${key}`).toBe(false);
    }
  }

  for (const entry of [...storageAudit.localDump, ...storageAudit.sessionDump]) {
    expect(/ya29\.[A-Za-z0-9_-]+/.test(entry)).toBe(false);
  }

  const cookies = await page.context().cookies();
  for (const cookie of cookies) {
    for (const pattern of FORBIDDEN_CREDENTIAL_KEY_PATTERNS) {
      expect(pattern.test(cookie.name), `Forbidden cookie found: ${cookie.name}`).toBe(false);
    }
  }
}

const PRIMARY_NAV_HEADINGS: Record<PrimaryNavLabel, RegExp> = {
  Home: /command center/i,
  Projects: /^projects$/i,
  Prompts: /prompt studio/i,
  Skills: /skill deck/i,
  Settings: /^settings$/i,
};

export async function navigatePrimaryTab(page: Page, label: PrimaryNavLabel): Promise<void> {
  const nameRegex = new RegExp(`^${label}$`, 'i');
  const navScope = page
    .getByRole('navigation', { name: /primary navigation/i })
    .or(page.locator('nav').first())
    .first();
  const target = navScope
    .getByRole('link', { name: nameRegex })
    .or(navScope.getByRole('button', { name: nameRegex }))
    .first();

  await expect(target).toBeVisible();
  await target.click();

  const expectedPath = PRIMARY_NAV_ROUTES[label];
  await expect(page).toHaveURL(
    (url) => url.pathname === expectedPath || (expectedPath === '/' && url.pathname === ''),
  );
  // Lazy routes keep the previous page mounted until the chunk resolves; wait for the new heading.
  await expect(
    page.locator('main').getByRole('heading', { level: 1, name: PRIMARY_NAV_HEADINGS[label] }),
  ).toBeVisible();
}

export async function openNavDrawer(page: Page): Promise<void> {
  const drawerLinkCheck = page
    .locator('aside, [role="dialog"]')
    .getByRole('link', { name: /workflow|privacy/i })
    .or(page.locator('aside, [role="dialog"]').getByRole('button', { name: /workflow|privacy/i }))
    .first();

  if (await drawerLinkCheck.isVisible().catch(() => false)) {
    return;
  }

  const trigger = page
    .getByRole('button', { name: /menu|more|drawer|navigation/i })
    .first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawerContent = page
    .getByRole('link', { name: /workflow library/i })
    .or(page.getByRole('button', { name: /workflow library/i }))
    .or(page.getByRole('link', { name: /privacy/i }))
    .or(page.getByRole('button', { name: /privacy/i }))
    .first();
  await expect(drawerContent).toBeVisible();
}

export async function closeNavDrawer(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]').first();
  const closeBtn = dialog
    .getByRole('button', { name: /close|dismiss|cancel/i })
    .or(page.getByRole('button', { name: /close.*(menu|drawer|nav)/i }))
    .first();

  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
}

export async function navigateDrawerRoute(
  page: Page,
  labelOrPattern: string | RegExp,
): Promise<void> {
  const matcher =
    typeof labelOrPattern === 'string' ? new RegExp(labelOrPattern, 'i') : labelOrPattern;

  const findVisibleItem = () =>
    page
      .locator('nav, aside, [role="dialog"]')
      .getByRole('link', { name: matcher })
      .or(page.locator('nav, aside, [role="dialog"]').getByRole('button', { name: matcher }))
      .first();

  if (!(await findVisibleItem().isVisible().catch(() => false))) {
    await openNavDrawer(page);
  }

  const item = findVisibleItem();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.getByRole('dialog', { name: /navigation menu/i })).toBeHidden();
}

export async function expectHeading(page: Page, pattern: string | RegExp): Promise<void> {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  await expect(page.getByRole('heading', { level: 1, name: regex }).first()).toBeVisible();
}

export async function assertZeroHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth,
    `Horizontal overflow detected: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
}

export async function getThemeSnapshot(page: Page): Promise<ThemeSnapshot> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const match = bodyBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    let isDarkBg = true;
    if (match) {
      const r = Number(match[1]);
      const g = Number(match[2]);
      const b = Number(match[3]);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      isDarkBg = luminance < 0.45;
    }
    return {
      htmlClass: html.className,
      dataTheme: html.getAttribute('data-theme'),
      bodyBg,
      isDarkBg,
    };
  });
}

type SetInputFilePayload = Extract<Parameters<Locator['setInputFiles']>[0], { buffer: unknown }>;

export async function setJsonInputFile(
  inputLocator: Locator,
  filename: string,
  content: string,
): Promise<void> {
  const nodeBuffer = (
    globalThis as unknown as {
      Buffer: { from(data: string, encoding: string): SetInputFilePayload['buffer'] };
    }
  ).Buffer;
  await inputLocator.setInputFiles({
    name: filename,
    mimeType: 'application/json',
    buffer: nodeBuffer.from(content, 'utf-8'),
  });
}

export async function installExportSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__exportedBlobs = [];
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource): string => {
      const url = originalCreateObjectURL(obj);
      if (obj instanceof Blob) {
        const list = window.__exportedBlobs ?? [];
        list.push({ url, blob: obj });
        window.__exportedBlobs = list;
      }
      return url;
    };
  });
}

export async function getLatestExportedText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const blobs = window.__exportedBlobs ?? [];
    if (blobs.length === 0) {
      return '';
    }
    return blobs[blobs.length - 1].blob.text();
  });
}

export async function ensureServiceWorkerReady(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return false;
          const reg = await navigator.serviceWorker.ready;
          return Boolean(reg.active && reg.active.state === 'activated');
        }),
      { timeout: 15_000, message: 'Expected service worker to activate' },
    )
    .toBe(true);

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!('caches' in window)) return 0;
          const keys = await window.caches.keys();
          return keys.length;
        }),
      { timeout: 15_000, message: 'Expected service worker precache to populate' },
    )
    .toBeGreaterThan(0);

  const hasController = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!hasController) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
        timeout: 15_000,
      })
      .toBe(true);
  }
}

export interface CreateProjectInput {
  title: string;
  category?: (typeof PROJECT_CATEGORIES)[number];
  machineName?: string;
  workspaceLabel?: string;
  officialUrl?: string;
  description?: string;
  notes?: string;
  pinned?: boolean;
}

export async function createProjectViaUi(page: Page, fields: CreateProjectInput): Promise<void> {
  if (new URL(page.url()).pathname !== ROUTES.projects) {
    await navigatePrimaryTab(page, 'Projects');
  }
  const newBtn = page
    .getByRole('button', { name: /^new project$/i })
    .or(page.getByRole('button', { name: /^create your first project$/i }))
    .first();
  await expect(newBtn).toBeVisible();
  await newBtn.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^title$/i).fill(fields.title);
  if (fields.category) {
    await dialog.getByLabel(/^category$/i).selectOption(fields.category);
  }
  if (fields.machineName !== undefined) {
    await dialog.getByLabel(/^machine name$/i).fill(fields.machineName);
  }
  if (fields.workspaceLabel !== undefined) {
    await dialog.getByLabel(/^workspace label$/i).fill(fields.workspaceLabel);
  }
  if (fields.officialUrl !== undefined) {
    await dialog.getByLabel(/official antigravity session url/i).fill(fields.officialUrl);
  }
  if (fields.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(fields.description);
  }
  if (fields.notes !== undefined) {
    await dialog.getByLabel(/^notes$/i).fill(fields.notes);
  }
  if (fields.pinned !== undefined) {
    const checkbox = dialog.getByLabel(/pin this project/i);
    if (fields.pinned) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }

  await dialog.getByRole('button', { name: /^(create project|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  project?: string;
  status?: (typeof TASK_STATUSES)[number];
  priority?: (typeof TASK_PRIORITIES)[number];
  dueDate?: string;
  notes?: string;
}

export async function createTaskViaUi(page: Page, fields: CreateTaskInput): Promise<void> {
  if (new URL(page.url()).pathname !== ROUTES.tasks) {
    await navigateDrawerRoute(page, /task board/i);
    await expectHeading(page, /task board/i);
  }
  await page.getByRole('button', { name: /^new task$/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /new task/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^title$/i).fill(fields.title);
  if (fields.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(fields.description);
  }
  if (fields.project !== undefined) {
    await dialog.getByLabel(/^project$/i).selectOption({ label: fields.project });
  }
  if (fields.status !== undefined) {
    await dialog.getByLabel(/^status$/i).selectOption(fields.status);
  }
  if (fields.priority !== undefined) {
    await dialog.getByLabel(/^priority$/i).selectOption(fields.priority);
  }
  if (fields.dueDate !== undefined) {
    await dialog.getByLabel(/^due date$/i).fill(fields.dueDate);
  }
  if (fields.notes !== undefined) {
    await dialog.getByLabel(/^notes$/i).fill(fields.notes);
  }

  await dialog.getByRole('button', { name: /^(create task|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

export interface CreateSkillInput {
  name: string;
  category?: (typeof SKILL_CATEGORIES)[number];
  description?: string;
  instructions: string;
  samplePrompt?: string;
  tags?: string;
}

export async function createSkillViaUi(page: Page, fields: CreateSkillInput): Promise<void> {
  if (new URL(page.url()).pathname !== ROUTES.skills) {
    await navigatePrimaryTab(page, 'Skills');
  }
  await page.getByRole('button', { name: /^new skill$/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /new skill/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^name$/i).fill(fields.name);
  if (fields.category) {
    await dialog.getByLabel(/^category$/i).selectOption(fields.category);
  }
  if (fields.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(fields.description);
  }
  await dialog.getByLabel(/usage instructions/i).fill(fields.instructions);
  if (fields.samplePrompt !== undefined) {
    await dialog.getByLabel(/sample prompt/i).fill(fields.samplePrompt);
  }
  if (fields.tags !== undefined) {
    await dialog.getByLabel(/^tags$/i).fill(fields.tags);
  }

  await dialog.getByRole('button', { name: /^(create skill|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

export interface CreateWorkflowInput {
  title: string;
  category?: (typeof WORKFLOW_CATEGORIES)[number];
  description?: string;
  steps: string[];
  relatedSkills?: string;
  copyablePrompt?: string;
  tags?: string;
}

export async function createWorkflowViaUi(page: Page, fields: CreateWorkflowInput): Promise<void> {
  if (new URL(page.url()).pathname !== ROUTES.workflows) {
    await navigateDrawerRoute(page, /workflow library/i);
    await expectHeading(page, /workflow library/i);
  }
  await page.getByRole('button', { name: /^new workflow$/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /new workflow/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^title$/i).fill(fields.title);
  if (fields.category) {
    await dialog.getByLabel(/^category$/i).selectOption(fields.category);
  }
  if (fields.description !== undefined) {
    await dialog.getByLabel(/^description$/i).fill(fields.description);
  }
  for (let i = 0; i < fields.steps.length; i++) {
    if (i > 0) {
      await dialog.getByRole('button', { name: /^add step$/i }).click();
    }
    await dialog.getByLabel(new RegExp(`^step ${i + 1}$`, 'i')).fill(fields.steps[i]);
  }
  if (fields.relatedSkills !== undefined) {
    await dialog.getByLabel(/related skills/i).fill(fields.relatedSkills);
  }
  if (fields.copyablePrompt !== undefined) {
    await dialog.getByLabel(/copyable prompt/i).fill(fields.copyablePrompt);
  }
  if (fields.tags !== undefined) {
    await dialog.getByLabel(/^tags$/i).fill(fields.tags);
  }

  await dialog.getByRole('button', { name: /^(create workflow|save changes)$/i }).click();
  await expect(dialog).toBeHidden();
}

export async function assertTouchTargetSize(locator: Locator, minPx = 44): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'Expected visible element to have a bounding box').not.toBeNull();
  if (box) {
    expect(box.width, `Touch target width ${box.width}px < ${minPx}px`).toBeGreaterThanOrEqual(minPx);
    expect(box.height, `Touch target height ${box.height}px < ${minPx}px`).toBeGreaterThanOrEqual(minPx);
  }
}

export async function verifyFocusTrappedInDialog(
  page: Page,
  dialogLocator: Locator,
): Promise<void> {
  await expect(dialogLocator).toBeVisible();
  await expect
    .poll(
      async () => dialogLocator.evaluate((el) => el.contains(document.activeElement)),
      { message: 'Expected initial focus to move inside open dialog' },
    )
    .toBe(true);

  const focusableCount = await dialogLocator
    .locator(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    .count();

  const tabIterations = Math.max(focusableCount + 3, 6);
  for (let i = 0; i < tabIterations; i++) {
    await page.keyboard.press('Tab');
    const inside = await dialogLocator.evaluate((el) => el.contains(document.activeElement));
    expect(inside, `Focus escaped dialog on forward Tab #${i + 1}`).toBe(true);
  }

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    const inside = await dialogLocator.evaluate((el) => el.contains(document.activeElement));
    expect(inside, `Focus escaped dialog on Shift+Tab #${i + 1}`).toBe(true);
  }
}
