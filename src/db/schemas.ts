import { z } from 'zod';
import {
  ACTIVITY_CATEGORIES,
  PROJECT_CATEGORIES,
  SKILL_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  WORKFLOW_CATEGORIES,
} from '../types/domain';
import { sanitizePlainText, validateOfficialAntigravityUrl } from '../services/security';

function sanitizedNonEmptyString(maxLength: number, requiredMessage: string) {
  return z
    .string()
    .transform((val) => sanitizePlainText(val, Number.MAX_SAFE_INTEGER).trim())
    .pipe(z.string().min(1, requiredMessage).max(maxLength));
}

export const ProjectCategorySchema = z.enum(PROJECT_CATEGORIES);
export const SkillCategorySchema = z.enum(SKILL_CATEGORIES);
export const WorkflowCategorySchema = z.enum(WORKFLOW_CATEGORIES);
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export const TaskPrioritySchema = z.enum(TASK_PRIORITIES);
export const ActivityCategorySchema = z.enum(ACTIVITY_CATEGORIES);
export const ThemeModeSchema = z.enum(['dark', 'light'] as const);

export const OfficialAntigravityUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL is too long.')
  .superRefine((val, ctx) => {
    const res = validateOfficialAntigravityUrl(val, {
      allowEmpty: true,
      allowDocs: false,
    });
    if (!res.valid) {
      ctx.addIssue({
        code: 'custom',
        message: res.error ?? 'Invalid official Antigravity URL.',
      });
    }
  });

export const ProjectSchema = z.object({
  id: z.string().min(1).max(128),
  title: sanitizedNonEmptyString(140, 'Project title is required.'),
  category: ProjectCategorySchema,
  machineName: z.string().trim().max(120),
  workspaceLabel: z.string().trim().max(160),
  officialUrl: OfficialAntigravityUrlSchema,
  description: z.string().max(4000),
  notes: z.string().max(20000),
  pinned: z.boolean(),
  createdAt: z.string().min(1).max(64),
  updatedAt: z.string().min(1).max(64),
});

export const ProjectInputSchema = z.object({
  title: sanitizedNonEmptyString(140, 'Project title is required.'),
  category: ProjectCategorySchema,
  machineName: z.string().trim().max(120).default(''),
  workspaceLabel: z.string().trim().max(160).default(''),
  officialUrl: OfficialAntigravityUrlSchema.default(''),
  description: z.string().max(4000).default(''),
  notes: z.string().max(20000).default(''),
  pinned: z.boolean().default(false),
});

export const PromptTemplateSchema = z.object({
  id: z.string().min(1).max(128),
  title: sanitizedNonEmptyString(160, 'Prompt title is required.'),
  body: sanitizedNonEmptyString(50000, 'Prompt body is required.'),
  tags: z.array(sanitizedNonEmptyString(48, 'Tag is required.')).max(30),
  variables: z.array(sanitizedNonEmptyString(64, 'Variable name is required.')).max(50),
  projectId: z.string().min(1).max(128).optional(),
  isStarter: z.boolean(),
  createdAt: z.string().min(1).max(64),
  updatedAt: z.string().min(1).max(64),
});

export const PromptTemplateInputSchema = z.object({
  title: sanitizedNonEmptyString(160, 'Prompt title is required.'),
  body: sanitizedNonEmptyString(50000, 'Prompt body is required.'),
  tags: z.array(sanitizedNonEmptyString(48, 'Tag is required.')).max(30).default([]),
  projectId: z.string().min(1).max(128).optional(),
});

export const PromptDraftSchema = z.object({
  id: z.literal('active'),
  title: z.string().max(160),
  body: z.string().max(50000),
  variableValues: z.record(z.string(), z.string()),
  selectedTemplateId: z.string().min(1).max(128).optional(),
  selectedProjectId: z.string().min(1).max(128).optional(),
  updatedAt: z.string().min(1).max(64),
});

export const SkillEntrySchema = z.object({
  id: z.string().min(1).max(128),
  name: sanitizedNonEmptyString(140, 'Skill name is required.'),
  category: SkillCategorySchema,
  description: z.string().max(4000),
  instructions: sanitizedNonEmptyString(30000, 'Skill instructions are required.'),
  samplePrompt: z.string().max(10000),
  tags: z.array(sanitizedNonEmptyString(48, 'Tag is required.')).max(30),
  isFavorite: z.boolean(),
  isStarter: z.boolean(),
  createdAt: z.string().min(1).max(64),
  updatedAt: z.string().min(1).max(64),
});

export const SkillInputSchema = z.object({
  name: sanitizedNonEmptyString(140, 'Skill name is required.'),
  category: SkillCategorySchema,
  description: z.string().max(4000).default(''),
  instructions: sanitizedNonEmptyString(30000, 'Skill instructions are required.'),
  samplePrompt: z.string().max(10000).default(''),
  tags: z.array(sanitizedNonEmptyString(48, 'Tag is required.')).max(30).default([]),
  isFavorite: z.boolean().default(false),
});

export const WorkflowEntrySchema = z.object({
  id: z.string().min(1).max(128),
  title: sanitizedNonEmptyString(160, 'Workflow title is required.'),
  description: z.string().max(4000),
  category: WorkflowCategorySchema,
  steps: z
    .array(sanitizedNonEmptyString(1000, 'Workflow step cannot be empty.'))
    .min(1, 'At least one step is required.')
    .max(50),
  relatedSkills: z.array(sanitizedNonEmptyString(140, 'Skill name is required.')).max(30),
  copyablePrompt: z.string().max(30000),
  tags: z.array(sanitizedNonEmptyString(48, 'Tag is required.')).max(30),
  isStarter: z.boolean(),
  createdAt: z.string().min(1).max(64),
  updatedAt: z.string().min(1).max(64),
});

export const WorkflowInputSchema = z.object({
  title: sanitizedNonEmptyString(160, 'Workflow title is required.'),
  description: z.string().max(4000).default(''),
  category: WorkflowCategorySchema,
  steps: z
    .array(sanitizedNonEmptyString(1000, 'Workflow step cannot be empty.'))
    .min(1, 'At least one step is required.')
    .max(50),
  relatedSkills: z.array(sanitizedNonEmptyString(140, 'Skill name is required.')).max(30).default([]),
  copyablePrompt: z.string().max(30000).default(''),
  tags: z.array(sanitizedNonEmptyString(48, 'Tag is required.')).max(30).default([]),
});

export const TaskItemSchema = z.object({
  id: z.string().min(1).max(128),
  title: sanitizedNonEmptyString(200, 'Task title is required.'),
  description: z.string().max(4000),
  projectId: z.string().min(1).max(128).optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dueDate: z.string().trim().max(32).optional(),
  notes: z.string().max(10000),
  createdAt: z.string().min(1).max(64),
  updatedAt: z.string().min(1).max(64),
});

export const TaskInputSchema = z.object({
  title: sanitizedNonEmptyString(200, 'Task title is required.'),
  description: z.string().max(4000).default(''),
  projectId: z.string().min(1).max(128).optional(),
  status: TaskStatusSchema.default('Planned'),
  priority: TaskPrioritySchema.default('Medium'),
  dueDate: z.string().trim().max(32).optional(),
  notes: z.string().max(10000).default(''),
});

export const ActivityLogEntrySchema = z.object({
  id: z.string().min(1).max(128),
  timestamp: z.string().min(1).max(64),
  category: ActivityCategorySchema,
  description: sanitizedNonEmptyString(1000, 'Activity description is required.'),
  projectId: z.string().min(1).max(128).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const SetupWizardStateSchema = z.object({
  desktopRemoteControlEnabled: z.boolean(),
  mobileLauncherVerified: z.boolean(),
  cliReferenceReviewed: z.boolean(),
  remoteAgentsReviewed: z.boolean(),
  lastUpdatedAt: z.string().min(1).max(64).optional(),
});

export const AppSettingsSchema = z.object({
  id: z.literal('default'),
  theme: ThemeModeSchema,
  reducedMotion: z.boolean(),
  hapticsEnabled: z.boolean(),
  starterSeededVersion: z.number().int().min(0),
  setupWizard: SetupWizardStateSchema,
  updatedAt: z.string().min(1).max(64),
});

export const ExportBundleV1Schema = z.object({
  schemaVersion: z.literal(1),
  app: z.literal('ag-pocket'),
  exportedAt: z.string().min(1).max(64),
  data: z.object({
    projects: z.array(ProjectSchema).max(5000),
    prompts: z.array(PromptTemplateSchema).max(5000),
    skills: z.array(SkillEntrySchema).max(5000),
    workflows: z.array(WorkflowEntrySchema).max(5000),
    tasks: z.array(TaskItemSchema).max(10000),
    activityLog: z.array(ActivityLogEntrySchema).max(20000),
    settings: z.array(AppSettingsSchema).max(10),
    promptDrafts: z.array(PromptDraftSchema).max(10),
  }),
});

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}
