import type { ActivityCategory, ActivityLogEntry } from '../types/domain';
import { sanitizePlainText } from '../services/security';
import { AGPocketDB, db, generateEntityId, withDbErrorHandling } from './database';

export interface LogActivityInput {
  category: ActivityCategory;
  description: string;
  projectId?: string;
  metadata?: Record<string, string>;
}

export interface GetActivityLogOptions {
  category?: ActivityCategory;
  projectId?: string;
  limit?: number;
}

export async function logActivity(
  input: LogActivityInput,
  targetDb: AGPocketDB = db
): Promise<ActivityLogEntry> {
  return withDbErrorHandling('Record activity log entry', async () => {
    const cleanDescription = sanitizePlainText(input.description, 1000).trim();
    const cleanMetadata = input.metadata
      ? Object.fromEntries(
          Object.entries(input.metadata).map(([k, v]) => [
            sanitizePlainText(k, 120),
            sanitizePlainText(v, 500),
          ])
        )
      : undefined;

    const entry: ActivityLogEntry = {
      id: generateEntityId(),
      timestamp: new Date().toISOString(),
      category: input.category,
      description: cleanDescription.length > 0 ? cleanDescription : 'Local action recorded.',
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(cleanMetadata ? { metadata: cleanMetadata } : {}),
    };

    await targetDb.activityLog.add(entry);
    return entry;
  });
}

export async function getActivityLog(
  options?: GetActivityLogOptions,
  targetDb: AGPocketDB = db
): Promise<ActivityLogEntry[]> {
  return withDbErrorHandling('Load activity log', async () => {
    let entries = await targetDb.activityLog.orderBy('timestamp').reverse().toArray();

    if (options?.category) {
      entries = entries.filter((entry) => entry.category === options.category);
    }

    if (options?.projectId) {
      entries = entries.filter((entry) => entry.projectId === options.projectId);
    }

    if (typeof options?.limit === 'number' && options.limit >= 0) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  });
}

export async function clearActivityLog(targetDb: AGPocketDB = db): Promise<void> {
  return withDbErrorHandling('Clear activity log', async () => {
    await targetDb.activityLog.clear();
  });
}
