import { afterEach, describe, expect, it } from 'vitest';
import { clearActivityLog, getActivityLog, logActivity } from '../db/activityService';
import { AGPocketDB } from '../db/database';

describe('activityService', () => {
  const createdDbs: AGPocketDB[] = [];

  function createIsolatedDb(suffix: string): AGPocketDB {
    const instance = new AGPocketDB(`ag-pocket-act-${suffix}-${Math.random().toString(36).slice(2)}`);
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

  it('logs sanitized entries, retrieves newest-first with filters, and clears history', async () => {
    const testDb = createIsolatedDb('log');

    await logActivity(
      {
        category: 'project',
        description: 'Created project\u0000 Alpha',
        projectId: 'proj-alpha',
        metadata: { action: 'create\u0007' },
      },
      testDb
    );

    await new Promise((resolve) => setTimeout(resolve, 5));

    await logActivity(
      {
        category: 'prompt',
        description: 'Copied prompt to clipboard',
        projectId: 'proj-beta',
      },
      testDb
    );

    const all = await getActivityLog(undefined, testDb);
    expect(all).toHaveLength(2);
    expect(all[0]?.category).toBe('prompt');
    expect(all[1]?.description).toBe('Created project Alpha');
    expect(all[1]?.metadata).toEqual({ action: 'create' });

    const onlyAlpha = await getActivityLog({ projectId: 'proj-alpha' }, testDb);
    expect(onlyAlpha).toHaveLength(1);

    const limited = await getActivityLog({ limit: 1 }, testDb);
    expect(limited).toHaveLength(1);

    await clearActivityLog(testDb);
    expect(await getActivityLog(undefined, testDb)).toHaveLength(0);
  });
});
