import { afterEach, describe, expect, it } from 'vitest';
import { AGPocketDB, StorageOperationError, withDbErrorHandling } from '../db/database';
import { ensureSeeded } from '../db/seedData';
import { computeConnectionReadiness } from '../types/domain';

const EXPECTED_STARTER_PROMPT_TITLES = [
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
];

const EXPECTED_STARTER_SKILL_NAMES = [
  'Hallmark',
  'Teamwork',
  'Swarm',
  'Red Antigravity Skills',
  'Frontend Engineering',
  'UI/UX Design',
  'Code Review',
  'Testing and QA',
  'Security Review',
];

describe('AGPocketDB & idempotent starter seeding', () => {
  const createdDbs: AGPocketDB[] = [];

  function createIsolatedDb(suffix: string): AGPocketDB {
    const instance = new AGPocketDB(`ag-pocket-test-${suffix}-${Math.random().toString(36).slice(2)}`);
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

  it('seeds all 12 starter prompts, 9 starter skills, workflows across 4 categories, default settings, and active draft', async () => {
    const testDb = createIsolatedDb('seed');
    const first = await ensureSeeded(testDb);
    expect(first).toEqual({ seeded: true, version: 1 });

    const prompts = await testDb.prompts.toArray();
    expect(prompts).toHaveLength(12);
    expect(prompts.map((p) => p.title)).toEqual(EXPECTED_STARTER_PROMPT_TITLES);
    for (const prompt of prompts) {
      expect(prompt.variables).toEqual(
        expect.arrayContaining(['project_name', 'task_description'])
      );
    }

    const skills = await testDb.skills.toArray();
    expect(skills).toHaveLength(9);
    expect(skills.map((s) => s.name)).toEqual(EXPECTED_STARTER_SKILL_NAMES);

    const workflows = await testDb.workflows.toArray();
    const workflowCategories = new Set(workflows.map((w) => w.category));
    expect(workflowCategories).toEqual(
      new Set(['Development', 'Frontend', 'AI Engineering', 'Release Engineering'])
    );

    const settings = await testDb.settings.get('default');
    expect(settings?.starterSeededVersion).toBe(1);
    expect(settings?.theme).toBe('dark');

    const draft = await testDb.promptDrafts.get('active');
    expect(draft?.id).toBe('active');
  });

  it('never duplicates or resurrects deleted starters on repeated ensureSeeded calls', async () => {
    const testDb = createIsolatedDb('idempotent');
    await ensureSeeded(testDb);

    await testDb.prompts.delete('starter-prompt-01');
    await testDb.skills.delete('starter-skill-01');
    await testDb.workflows.delete('starter-workflow-01');

    const second = await ensureSeeded(testDb);
    expect(second).toEqual({ seeded: false, version: 1 });

    expect(await testDb.prompts.count()).toBe(11);
    expect(await testDb.skills.count()).toBe(8);
    expect(await testDb.workflows.get('starter-workflow-01')).toBeUndefined();
  });

  it('stores projects and skills with boolean flags and queries safely in JS', async () => {
    const testDb = createIsolatedDb('booleans');
    await ensureSeeded(testDb);

    const now = new Date().toISOString();
    await testDb.projects.put({
      id: 'proj-pin-1',
      title: 'Pinned Project',
      category: 'AI / ML',
      machineName: 'Studio Mac',
      workspaceLabel: 'main',
      officialUrl: 'https://antigravity.google.com',
      description: 'Test',
      notes: '',
      pinned: true,
      createdAt: now,
      updatedAt: now,
    });

    await testDb.skills.update('starter-skill-02', { isFavorite: true });

    const allProjects = await testDb.projects.orderBy('updatedAt').reverse().toArray();
    const pinnedProjects = allProjects.filter((p) => p.pinned);
    expect(pinnedProjects).toHaveLength(1);
    expect(pinnedProjects[0]?.id).toBe('proj-pin-1');

    const allSkills = await testDb.skills.toArray();
    const favSkills = allSkills.filter((s) => s.isFavorite);
    expect(favSkills).toHaveLength(1);
    expect(favSkills[0]?.name).toBe('Teamwork');

    const settings = await testDb.settings.get('default');
    expect(computeConnectionReadiness(settings, allProjects)).toBe(
      'Remote connection not verified'
    );
  });

  it('classifies Dexie-wrapped inner and cause QuotaExceededError as STORAGE_QUOTA_EXCEEDED', async () => {
    const innerWrappedError = Object.assign(new Error('Transaction aborted'), {
      name: 'AbortError',
      inner: {
        name: 'QuotaExceededError',
        message: 'DOM storage limit reached',
      },
    });

    await expect(
      withDbErrorHandling('Save item', () => Promise.reject(innerWrappedError))
    ).rejects.toMatchObject({
      name: 'StorageOperationError',
      code: 'STORAGE_QUOTA_EXCEEDED',
    } satisfies Partial<StorageOperationError>);

    const causeWrappedError = new Error('Wrapper failure', {
      cause: new DOMException('Exceeded', 'QuotaExceededError'),
    });

    await expect(
      withDbErrorHandling('Save item', () => Promise.reject(causeWrappedError))
    ).rejects.toMatchObject({
      name: 'StorageOperationError',
      code: 'STORAGE_QUOTA_EXCEEDED',
    } satisfies Partial<StorageOperationError>);
  });
});
