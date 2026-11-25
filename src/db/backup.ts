import type {
  ActivityLogEntry,
  AppSettings,
  EntityCounts,
  ExportBundleV1,
  ImportResult,
  Project,
  PromptDraft,
  PromptTemplate,
  SkillEntry,
  TaskItem,
  WorkflowEntry,
} from '../types/domain';
import {
  extractTemplateVariables,
  sanitizePlainText,
  validateOfficialAntigravityUrl,
} from '../services/security';
import {
  AGPocketDB,
  createDefaultAppSettings,
  createEmptyPromptDraft,
  db,
  generateEntityId,
  withDbErrorHandling,
} from './database';
import { ExportBundleV1Schema, formatZodIssues } from './schemas';
import { CURRENT_STARTER_SEED_VERSION } from './seedData';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MiB

function createZeroCounts(): EntityCounts {
  return {
    projects: 0,
    prompts: 0,
    skills: 0,
    workflows: 0,
    tasks: 0,
    activityLog: 0,
    settings: 0,
    promptDrafts: 0,
  };
}

function projectNaturalKey(project: Pick<Project, 'title' | 'workspaceLabel'>): string {
  return `${project.title.trim().toLowerCase()}::${project.workspaceLabel.trim().toLowerCase()}`;
}

function promptNaturalKey(prompt: Pick<PromptTemplate, 'title'>): string {
  return prompt.title.trim().toLowerCase();
}

function skillNaturalKey(skill: Pick<SkillEntry, 'name'>): string {
  return skill.name.trim().toLowerCase();
}

function workflowNaturalKey(workflow: Pick<WorkflowEntry, 'title'>): string {
  return workflow.title.trim().toLowerCase();
}

function taskNaturalKey(task: Pick<TaskItem, 'title' | 'projectId'>): string {
  return `${task.title.trim().toLowerCase()}::${task.projectId ?? ''}`;
}

export async function exportLocalData(targetDb: AGPocketDB = db): Promise<ExportBundleV1> {
  return withDbErrorHandling('Export local data', async () => {
    return targetDb.transaction(
      'r',
      [
        targetDb.projects,
        targetDb.prompts,
        targetDb.skills,
        targetDb.workflows,
        targetDb.tasks,
        targetDb.activityLog,
        targetDb.settings,
        targetDb.promptDrafts,
      ],
      async () => {
        const [projects, prompts, skills, workflows, tasks, activityLog, settings, promptDrafts] =
          await Promise.all([
            targetDb.projects.toArray(),
            targetDb.prompts.toArray(),
            targetDb.skills.toArray(),
            targetDb.workflows.toArray(),
            targetDb.tasks.toArray(),
            targetDb.activityLog.toArray(),
            targetDb.settings.toArray(),
            targetDb.promptDrafts.toArray(),
          ]);

        return {
          schemaVersion: 1,
          app: 'ag-pocket',
          exportedAt: new Date().toISOString(),
          data: {
            projects,
            prompts,
            skills,
            workflows,
            tasks,
            activityLog,
            settings,
            promptDrafts,
          },
        };
      }
    );
  });
}

export function serializeExportBundle(bundle: ExportBundleV1): string {
  return JSON.stringify(bundle, null, 2);
}

function sanitizeProject(raw: Project): Project {
  const urlResult = validateOfficialAntigravityUrl(raw.officialUrl, {
    allowEmpty: true,
    allowDocs: false,
  });
  return {
    ...raw,
    title: sanitizePlainText(raw.title, 140).trim(),
    machineName: sanitizePlainText(raw.machineName, 120).trim(),
    workspaceLabel: sanitizePlainText(raw.workspaceLabel, 160).trim(),
    officialUrl: urlResult.valid ? (urlResult.normalizedUrl ?? '') : '',
    description: sanitizePlainText(raw.description, 4000),
    notes: sanitizePlainText(raw.notes, 20000),
  };
}

function sanitizePrompt(raw: PromptTemplate): PromptTemplate {
  const cleanBody = sanitizePlainText(raw.body, 50000);
  return {
    ...raw,
    title: sanitizePlainText(raw.title, 160).trim(),
    body: cleanBody,
    tags: raw.tags.map((t) => sanitizePlainText(t, 48).trim()).filter(Boolean),
    variables: extractTemplateVariables(cleanBody),
  };
}

function sanitizeSkill(raw: SkillEntry): SkillEntry {
  return {
    ...raw,
    name: sanitizePlainText(raw.name, 140).trim(),
    description: sanitizePlainText(raw.description, 4000),
    instructions: sanitizePlainText(raw.instructions, 30000),
    samplePrompt: sanitizePlainText(raw.samplePrompt, 10000),
    tags: raw.tags.map((t) => sanitizePlainText(t, 48).trim()).filter(Boolean),
  };
}

function sanitizeWorkflow(raw: WorkflowEntry): WorkflowEntry {
  return {
    ...raw,
    title: sanitizePlainText(raw.title, 160).trim(),
    description: sanitizePlainText(raw.description, 4000),
    steps: raw.steps.map((s) => sanitizePlainText(s, 1000).trim()).filter(Boolean),
    relatedSkills: raw.relatedSkills.map((s) => sanitizePlainText(s, 140).trim()).filter(Boolean),
    copyablePrompt: sanitizePlainText(raw.copyablePrompt, 30000),
    tags: raw.tags.map((t) => sanitizePlainText(t, 48).trim()).filter(Boolean),
  };
}

function sanitizeTask(raw: TaskItem): TaskItem {
  return {
    ...raw,
    title: sanitizePlainText(raw.title, 200).trim(),
    description: sanitizePlainText(raw.description, 4000),
    dueDate: raw.dueDate ? sanitizePlainText(raw.dueDate, 32).trim() || undefined : undefined,
    notes: sanitizePlainText(raw.notes, 10000),
  };
}

function sanitizeActivity(raw: ActivityLogEntry): ActivityLogEntry {
  const metadata = raw.metadata
    ? Object.fromEntries(
        Object.entries(raw.metadata).map(([k, v]) => [
          sanitizePlainText(k, 120),
          sanitizePlainText(v, 500),
        ])
      )
    : undefined;

  return {
    ...raw,
    description: sanitizePlainText(raw.description, 1000).trim(),
    metadata,
  };
}

function sanitizeDraft(raw: PromptDraft): PromptDraft {
  const variableValues = Object.fromEntries(
    Object.entries(raw.variableValues).map(([k, v]) => [
      sanitizePlainText(k, 64),
      sanitizePlainText(v, 10000),
    ])
  );

  return {
    ...raw,
    title: sanitizePlainText(raw.title, 160),
    body: sanitizePlainText(raw.body, 50000),
    variableValues,
  };
}

export async function importLocalData(
  jsonString: string,
  targetDb: AGPocketDB = db
): Promise<ImportResult> {
  const importedCounts = createZeroCounts();
  const skippedDuplicates = createZeroCounts();

  if (typeof jsonString !== 'string' || jsonString.trim().length === 0) {
    return {
      ok: false,
      importedCounts,
      skippedDuplicates,
      errors: ['Import payload is empty.'],
    };
  }

  const byteLength = new TextEncoder().encode(jsonString).byteLength;
  if (byteLength > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      importedCounts,
      skippedDuplicates,
      errors: [`Import file exceeds the ${MAX_IMPORT_BYTES / (1024 * 1024)} MiB size limit.`],
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonString);
  } catch {
    return {
      ok: false,
      importedCounts,
      skippedDuplicates,
      errors: ['Invalid JSON syntax. Please select a valid AG Pocket export file.'],
    };
  }

  const validated = ExportBundleV1Schema.safeParse(parsedJson);
  if (!validated.success) {
    return {
      ok: false,
      importedCounts,
      skippedDuplicates,
      errors: formatZodIssues(validated.error),
    };
  }

  const bundle = validated.data;

  return withDbErrorHandling('Import local data', async () => {
    await targetDb.transaction(
      'rw',
      [
        targetDb.projects,
        targetDb.prompts,
        targetDb.skills,
        targetDb.workflows,
        targetDb.tasks,
        targetDb.activityLog,
        targetDb.settings,
        targetDb.promptDrafts,
      ],
      async () => {
        const [
          existingProjects,
          existingPrompts,
          existingSkills,
          existingWorkflows,
          existingTasks,
          existingActivity,
          existingSettings,
          existingDraft,
        ] = await Promise.all([
          targetDb.projects.toArray(),
          targetDb.prompts.toArray(),
          targetDb.skills.toArray(),
          targetDb.workflows.toArray(),
          targetDb.tasks.toArray(),
          targetDb.activityLog.toArray(),
          targetDb.settings.get('default'),
          targetDb.promptDrafts.get('active'),
        ]);

        const seenProjectIds = new Set(existingProjects.map((p) => p.id));
        const seenProjectKeys = new Set(existingProjects.map(projectNaturalKey));
        const projectsToAdd: Project[] = [];

        for (const item of bundle.data.projects) {
          const clean = sanitizeProject(item);
          const key = projectNaturalKey(clean);
          if (seenProjectIds.has(clean.id) || seenProjectKeys.has(key)) {
            skippedDuplicates.projects += 1;
            continue;
          }
          seenProjectIds.add(clean.id);
          seenProjectKeys.add(key);
          projectsToAdd.push(clean);
          importedCounts.projects += 1;
        }
        if (projectsToAdd.length > 0) {
          await targetDb.projects.bulkAdd(projectsToAdd);
        }

        const seenPromptIds = new Set(existingPrompts.map((p) => p.id));
        const seenPromptKeys = new Set(existingPrompts.map(promptNaturalKey));
        const promptsToAdd: PromptTemplate[] = [];

        for (const item of bundle.data.prompts) {
          const clean = sanitizePrompt(item);
          const key = promptNaturalKey(clean);
          if (seenPromptIds.has(clean.id) || seenPromptKeys.has(key)) {
            skippedDuplicates.prompts += 1;
            continue;
          }
          seenPromptIds.add(clean.id);
          seenPromptKeys.add(key);
          promptsToAdd.push(clean);
          importedCounts.prompts += 1;
        }
        if (promptsToAdd.length > 0) {
          await targetDb.prompts.bulkAdd(promptsToAdd);
        }

        const seenSkillIds = new Set(existingSkills.map((s) => s.id));
        const seenSkillKeys = new Set(existingSkills.map(skillNaturalKey));
        const skillsToAdd: SkillEntry[] = [];

        for (const item of bundle.data.skills) {
          const clean = sanitizeSkill(item);
          const key = skillNaturalKey(clean);
          if (seenSkillIds.has(clean.id) || seenSkillKeys.has(key)) {
            skippedDuplicates.skills += 1;
            continue;
          }
          seenSkillIds.add(clean.id);
          seenSkillKeys.add(key);
          skillsToAdd.push(clean);
          importedCounts.skills += 1;
        }
        if (skillsToAdd.length > 0) {
          await targetDb.skills.bulkAdd(skillsToAdd);
        }

        const seenWorkflowIds = new Set(existingWorkflows.map((w) => w.id));
        const seenWorkflowKeys = new Set(existingWorkflows.map(workflowNaturalKey));
        const workflowsToAdd: WorkflowEntry[] = [];

        for (const item of bundle.data.workflows) {
          const clean = sanitizeWorkflow(item);
          const key = workflowNaturalKey(clean);
          if (seenWorkflowIds.has(clean.id) || seenWorkflowKeys.has(key)) {
            skippedDuplicates.workflows += 1;
            continue;
          }
          seenWorkflowIds.add(clean.id);
          seenWorkflowKeys.add(key);
          workflowsToAdd.push(clean);
          importedCounts.workflows += 1;
        }
        if (workflowsToAdd.length > 0) {
          await targetDb.workflows.bulkAdd(workflowsToAdd);
        }

        const seenTaskIds = new Set(existingTasks.map((t) => t.id));
        const seenTaskKeys = new Set(existingTasks.map(taskNaturalKey));
        const tasksToAdd: TaskItem[] = [];

        for (const item of bundle.data.tasks) {
          const clean = sanitizeTask(item);
          const key = taskNaturalKey(clean);
          if (seenTaskIds.has(clean.id) || seenTaskKeys.has(key)) {
            skippedDuplicates.tasks += 1;
            continue;
          }
          seenTaskIds.add(clean.id);
          seenTaskKeys.add(key);
          tasksToAdd.push(clean);
          importedCounts.tasks += 1;
        }
        if (tasksToAdd.length > 0) {
          await targetDb.tasks.bulkAdd(tasksToAdd);
        }

        const seenActivityIds = new Set(existingActivity.map((a) => a.id));
        const activityToAdd: ActivityLogEntry[] = [];

        for (const item of bundle.data.activityLog) {
          const clean = sanitizeActivity(item);
          if (seenActivityIds.has(clean.id)) {
            skippedDuplicates.activityLog += 1;
            continue;
          }
          seenActivityIds.add(clean.id);
          activityToAdd.push(clean);
          importedCounts.activityLog += 1;
        }
        if (activityToAdd.length > 0) {
          await targetDb.activityLog.bulkAdd(activityToAdd);
        }

        let settingsProcessed = false;
        for (const incomingSetting of bundle.data.settings) {
          if (settingsProcessed) {
            skippedDuplicates.settings += 1;
            continue;
          }
          settingsProcessed = true;

          const mergedSeedVersion = Math.max(
            existingSettings?.starterSeededVersion ?? 0,
            incomingSetting.starterSeededVersion,
            CURRENT_STARTER_SEED_VERSION
          );

          const mergedSettings: AppSettings = {
            ...incomingSetting,
            id: 'default',
            starterSeededVersion: mergedSeedVersion,
            updatedAt: new Date().toISOString(),
          };
          await targetDb.settings.put(mergedSettings);
          importedCounts.settings += 1;
        }

        let draftProcessed = false;
        const hasNonEmptyExistingDraft =
          Boolean(existingDraft) &&
          (existingDraft!.body.trim().length > 0 || existingDraft!.title.trim().length > 0);

        for (const incomingDraft of bundle.data.promptDrafts) {
          const cleanDraft = sanitizeDraft(incomingDraft);
          if (draftProcessed || hasNonEmptyExistingDraft) {
            skippedDuplicates.promptDrafts += 1;
            continue;
          }
          draftProcessed = true;
          await targetDb.promptDrafts.put(cleanDraft);
          importedCounts.promptDrafts += 1;
        }

        const totalImported =
          importedCounts.projects +
          importedCounts.prompts +
          importedCounts.skills +
          importedCounts.workflows +
          importedCounts.tasks;

        if (totalImported > 0) {
          await targetDb.activityLog.add({
            id: generateEntityId(),
            timestamp: new Date().toISOString(),
            category: 'system',
            description: `Imported backup (${importedCounts.projects} projects, ${importedCounts.prompts} prompts, ${importedCounts.skills} skills, ${importedCounts.workflows} workflows, ${importedCounts.tasks} tasks).`,
          });
        }
      }
    );

    return {
      ok: true,
      importedCounts,
      skippedDuplicates,
      errors: [],
    };
  });
}

export async function clearAllLocalData(targetDb: AGPocketDB = db): Promise<void> {
  return withDbErrorHandling('Clear all local data', async () => {
    await targetDb.transaction(
      'rw',
      [
        targetDb.projects,
        targetDb.prompts,
        targetDb.skills,
        targetDb.workflows,
        targetDb.tasks,
        targetDb.activityLog,
        targetDb.settings,
        targetDb.promptDrafts,
      ],
      async () => {
        await Promise.all([
          targetDb.projects.clear(),
          targetDb.prompts.clear(),
          targetDb.skills.clear(),
          targetDb.workflows.clear(),
          targetDb.tasks.clear(),
          targetDb.activityLog.clear(),
          targetDb.settings.clear(),
          targetDb.promptDrafts.clear(),
        ]);

        const now = new Date().toISOString();
        await targetDb.settings.put(
          createDefaultAppSettings(now, CURRENT_STARTER_SEED_VERSION)
        );
        await targetDb.promptDrafts.put(createEmptyPromptDraft(now));
      }
    );
  });
}
