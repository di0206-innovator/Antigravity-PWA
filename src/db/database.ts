import Dexie, { type EntityTable } from 'dexie';
import type {
  ActivityLogEntry,
  AppSettings,
  Project,
  PromptDraft,
  PromptTemplate,
  SkillEntry,
  TaskItem,
  WorkflowEntry,
} from '../types/domain';

export const CURRENT_DB_SCHEMA_VERSION = 1;

export type StorageErrorCode =
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_OPERATION_FAILED';

export class StorageOperationError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'StorageOperationError';
    this.code = code;
  }
}

export class AGPocketDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  prompts!: EntityTable<PromptTemplate, 'id'>;
  skills!: EntityTable<SkillEntry, 'id'>;
  workflows!: EntityTable<WorkflowEntry, 'id'>;
  tasks!: EntityTable<TaskItem, 'id'>;
  activityLog!: EntityTable<ActivityLogEntry, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  promptDrafts!: EntityTable<PromptDraft, 'id'>;

  constructor(name = 'ag-pocket-db') {
    super(name);

    // Note: Never query boolean properties (`pinned`, `isFavorite`) via `.where(...).equals(true)`
    // because IndexedDB 3.0 disallows booleans as valid index keys; filter in JS instead.
    this.version(1).stores({
      projects: 'id, title, category, pinned, updatedAt',
      prompts: 'id, title, projectId, *tags, updatedAt',
      skills: 'id, name, category, isFavorite, updatedAt',
      workflows: 'id, title, category, *tags, updatedAt',
      tasks: 'id, title, projectId, status, priority, dueDate, updatedAt',
      activityLog: 'id, timestamp, category, projectId',
      settings: 'id',
      promptDrafts: 'id',
    });

    // Future schema migrations extend here cleanly:
    // this.version(2).stores({ ... }).upgrade(async (tx) => { ... });
  }
}

export const db = new AGPocketDB();

export function createDefaultAppSettings(
  nowIso: string = new Date().toISOString(),
  starterSeededVersion = 0
): AppSettings {
  return {
    id: 'default',
    theme: 'dark',
    reducedMotion: false,
    hapticsEnabled: true,
    starterSeededVersion,
    setupWizard: {
      desktopRemoteControlEnabled: false,
      mobileLauncherVerified: false,
      cliReferenceReviewed: false,
      remoteAgentsReviewed: false,
    },
    updatedAt: nowIso,
  };
}

export function createEmptyPromptDraft(nowIso: string = new Date().toISOString()): PromptDraft {
  return {
    id: 'active',
    title: '',
    body: '',
    tags: [],
    variableValues: {},
    updatedAt: nowIso,
  };
}

export function generateEntityId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `ag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractErrorDetails(err: unknown): Array<{ name: string; message: string }> {
  const details: Array<{ name: string; message: string }> = [];
  const visited = new Set<unknown>();
  const queue: unknown[] = [err];

  while (queue.length > 0 && details.length < 10) {
    const current = queue.shift();
    if (current === null || current === undefined || visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (typeof current === 'object') {
      const record = current as {
        name?: unknown;
        message?: unknown;
        inner?: unknown;
        cause?: unknown;
      };
      const name = typeof record.name === 'string' ? record.name : '';
      const message =
        typeof record.message === 'string'
          ? record.message
          : current instanceof Error
            ? current.message
            : '';
      details.push({ name, message });

      if (record.inner !== undefined) {
        queue.push(record.inner);
      }
      if (record.cause !== undefined) {
        queue.push(record.cause);
      }
    } else {
      details.push({ name: '', message: String(current) });
    }
  }

  return details;
}

export async function withDbErrorHandling<T>(
  context: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof StorageOperationError) {
      throw err;
    }

    const details = extractErrorDetails(err);

    if (details.some((d) => d.name === 'QuotaExceededError' || /quota/i.test(d.message))) {
      throw new StorageOperationError(
        'STORAGE_QUOTA_EXCEEDED',
        `${context}: local browser storage quota exceeded. Export and clear old data to free space.`,
        err
      );
    }

    if (
      details.some(
        (d) =>
          d.name === 'MissingAPIError' ||
          d.name === 'SecurityError' ||
          /indexeddb/i.test(d.message)
      )
    ) {
      throw new StorageOperationError(
        'STORAGE_UNAVAILABLE',
        `${context}: IndexedDB storage is unavailable in this browser context.`,
        err
      );
    }

    throw new StorageOperationError(
      'STORAGE_OPERATION_FAILED',
      `${context}: unable to complete local storage operation.`,
      err
    );
  }
}
