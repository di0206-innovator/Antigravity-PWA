import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAllLocalData,
  exportLocalData,
  importLocalData,
  serializeExportBundle,
} from '../db/backup';
import { AGPocketDB } from '../db/database';
import { ensureSeeded } from '../db/seedData';

describe('backup export, import, deduplication, and clearAllLocalData', () => {
  const createdDbs: AGPocketDB[] = [];

  function createIsolatedDb(suffix: string): AGPocketDB {
    const instance = new AGPocketDB(`ag-pocket-backup-${suffix}-${Math.random().toString(36).slice(2)}`);
    createdDbs.push(instance);
    return instance;
  }

  afterEach(async () => {
    while (createdDbs.length > 0) {
      const instance = createdDbs.pop();
      if (instance) {
        await instance.delete();
      }
    }
  });

  it('round-trips local data via export and import and deduplicates existing records', async () => {
    const sourceDb = createIsolatedDb('source');
    const targetDb = createIsolatedDb('target');
    await ensureSeeded(sourceDb);
    await ensureSeeded(targetDb);

    const now = '2026-11-25T05:00:00.000Z';
    await sourceDb.projects.add({
      id: 'proj-custom-1',
      title: 'Mobile Command',
      category: 'Mobile Development',
      machineName: 'MacBook Pro',
      workspaceLabel: 'mobile-app',
      officialUrl: 'https://antigravity.google.com/r/session-42',
      description: 'Desc',
      notes: 'Notes',
      pinned: true,
      createdAt: now,
      updatedAt: now,
    });
    await sourceDb.tasks.add({
      id: 'task-custom-1',
      title: 'Verify offline mode',
      description: 'Test SW fallback',
      projectId: 'proj-custom-1',
      status: 'Planned',
      priority: 'High',
      notes: '',
      createdAt: now,
      updatedAt: now,
    });

    const bundle = await exportLocalData(sourceDb);
    const json = serializeExportBundle(bundle);

    const firstImport = await importLocalData(json, targetDb);
    expect(firstImport.ok).toBe(true);
    expect(firstImport.importedCounts.projects).toBe(1);
    expect(firstImport.importedCounts.tasks).toBe(1);
    // Starters already existed in targetDb so they were skipped as duplicates
    expect(firstImport.skippedDuplicates.prompts).toBe(12);
    expect(firstImport.skippedDuplicates.skills).toBe(9);

    const importedProject = await targetDb.projects.get('proj-custom-1');
    expect(importedProject?.officialUrl).toBe('https://antigravity.google.com/r/session-42');

    // Re-importing the exact same bundle with a different ID but same natural key must also dedupe
    const mutatedBundle = {
      ...bundle,
      data: {
        ...bundle.data,
        projects: [
          {
            ...bundle.data.projects[0],
            id: 'proj-custom-different-id',
          },
        ],
      },
    };
    const secondImport = await importLocalData(JSON.stringify(mutatedBundle), targetDb);
    expect(secondImport.ok).toBe(true);
    expect(secondImport.importedCounts.projects).toBe(0);
    expect(secondImport.skippedDuplicates.projects).toBe(1);
    expect(await targetDb.projects.count()).toBe(1);
  });

  it('rejects corrupt JSON, wrong schemaVersion, or unsafe URLs without mutating existing DB', async () => {
    const testDb = createIsolatedDb('invalid');
    await ensureSeeded(testDb);
    const now = '2026-11-25T05:00:00.000Z';
    await testDb.projects.add({
      id: 'existing-proj',
      title: 'Keep Me',
      category: 'Other',
      machineName: '',
      workspaceLabel: '',
      officialUrl: '',
      description: '',
      notes: '',
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });

    const badJson = await importLocalData('{not valid json', testDb);
    expect(badJson.ok).toBe(false);
    expect(badJson.errors.length).toBeGreaterThan(0);

    const badVersion = await importLocalData(
      JSON.stringify({ schemaVersion: 99, app: 'ag-pocket', exportedAt: now, data: {} }),
      testDb
    );
    expect(badVersion.ok).toBe(false);

    const validBundle = await exportLocalData(testDb);
    const evilBundle = {
      ...validBundle,
      data: {
        ...validBundle.data,
        projects: [
          {
            id: 'evil-proj',
            title: 'Evil',
            category: 'Other',
            machineName: '',
            workspaceLabel: '',
            officialUrl: 'https://evil.example.com/phish',
            description: '',
            notes: '',
            pinned: false,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    };
    const evilResult = await importLocalData(JSON.stringify(evilBundle), testDb);
    expect(evilResult.ok).toBe(false);
    expect(evilResult.errors.join(' ')).toMatch(/antigravity\.google\.com/i);

    // Existing DB remains completely untouched
    expect(await testDb.projects.count()).toBe(1);
    expect(await testDb.projects.get('existing-proj')).toBeDefined();
    expect(await testDb.projects.get('evil-proj')).toBeUndefined();
  });

  it('clearAllLocalData wipes all user and starter rows while keeping clean default settings', async () => {
    const testDb = createIsolatedDb('clear');
    await ensureSeeded(testDb);
    await testDb.projects.add({
      id: 'p1',
      title: 'Project 1',
      category: 'Backend',
      machineName: '',
      workspaceLabel: '',
      officialUrl: '',
      description: '',
      notes: '',
      pinned: false,
      createdAt: '2026-11-25T05:00:00.000Z',
      updatedAt: '2026-11-25T05:00:00.000Z',
    });

    await clearAllLocalData(testDb);

    expect(await testDb.projects.count()).toBe(0);
    expect(await testDb.prompts.count()).toBe(0);
    expect(await testDb.skills.count()).toBe(0);
    expect(await testDb.workflows.count()).toBe(0);
    expect(await testDb.tasks.count()).toBe(0);
    expect(await testDb.activityLog.count()).toBe(0);

    const settings = await testDb.settings.get('default');
    expect(settings?.starterSeededVersion).toBe(1);
    expect(settings?.theme).toBe('dark');

    const draft = await testDb.promptDrafts.get('active');
    expect(draft?.body).toBe('');
  });

  it('rejects control-char-only required fields and drops smuggled PromptTemplate.variables on import', async () => {
    const testDb = createIsolatedDb('sanitize');
    await ensureSeeded(testDb);
    const now = '2026-11-25T05:00:00.000Z';

    const baseBundle = await exportLocalData(testDb);
    const ctrlBundle = {
      ...baseBundle,
      data: {
        ...baseBundle.data,
        projects: [
          {
            id: 'ctrl-proj',
            title: '\u0001\u0002',
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
        ],
        workflows: [
          {
            id: 'ctrl-wf',
            title: 'Valid WF',
            description: '',
            category: 'Development',
            steps: ['\u0001\u0002'],
            relatedSkills: [],
            copyablePrompt: '',
            tags: [],
            isStarter: false,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    };

    const ctrlResult = await importLocalData(JSON.stringify(ctrlBundle), testDb);
    expect(ctrlResult.ok).toBe(false);
    expect(await testDb.projects.count()).toBe(0);
    expect(await testDb.workflows.get('ctrl-wf')).toBeUndefined();

    const smuggledVarsBundle = {
      ...baseBundle,
      data: {
        ...baseBundle.data,
        prompts: [
          {
            id: 'zero-var-prompt',
            title: 'Zero Var\u0000 Prompt',
            body: 'Plain prompt body with zero variables.',
            tags: ['tag\u00001'],
            variables: ['\u0000evil_var', '<script>alert(1)</script>'],
            isStarter: false,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    };

    const smuggledResult = await importLocalData(JSON.stringify(smuggledVarsBundle), testDb);
    expect(smuggledResult.ok).toBe(true);
    expect(smuggledResult.importedCounts.prompts).toBe(1);

    const savedPrompt = await testDb.prompts.get('zero-var-prompt');
    expect(savedPrompt?.title).toBe('Zero Var Prompt');
    expect(savedPrompt?.tags).toEqual(['tag1']);
    expect(savedPrompt?.variables).toEqual([]);
  });
});
