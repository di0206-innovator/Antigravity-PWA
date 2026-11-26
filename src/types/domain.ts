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
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

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
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const WORKFLOW_CATEGORIES = [
  'Development',
  'Frontend',
  'AI Engineering',
  'Release Engineering',
  'Custom',
] as const;
export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number];

export const TASK_STATUSES = [
  'Backlog',
  'Planned',
  'In Progress',
  'Needs Attention',
  'Completed',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const ACTIVITY_CATEGORIES = [
  'project',
  'prompt',
  'skill',
  'workflow',
  'task',
  'setup',
  'system',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const CONNECTION_READINESS_STATES = [
  'Not configured',
  'Setup instructions available',
  'Ready to open',
  'Remote connection not verified',
] as const;
export type ConnectionReadiness = (typeof CONNECTION_READINESS_STATES)[number];

export type ThemeMode = 'dark' | 'light';

export interface Project {
  id: string;
  title: string;
  category: ProjectCategory;
  machineName: string;
  workspaceLabel: string;
  officialUrl: string;
  description: string;
  notes: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  body: string;
  tags: string[];
  variables: string[];
  projectId?: string;
  isStarter: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptDraft {
  id: 'active';
  title: string;
  body: string;
  tags?: string[];
  variableValues: Record<string, string>;
  selectedTemplateId?: string;
  selectedProjectId?: string;
  updatedAt: string;
}

export interface SkillEntry {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  instructions: string;
  samplePrompt: string;
  tags: string[];
  isFavorite: boolean;
  isStarter: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEntry {
  id: string;
  title: string;
  description: string;
  category: WorkflowCategory;
  steps: string[];
  relatedSkills: string[];
  copyablePrompt: string;
  tags: string[];
  isStarter: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  category: ActivityCategory;
  description: string;
  projectId?: string;
  metadata?: Record<string, string>;
}

export interface SetupWizardState {
  desktopRemoteControlEnabled: boolean;
  mobileLauncherVerified: boolean;
  cliReferenceReviewed: boolean;
  remoteAgentsReviewed: boolean;
  lastUpdatedAt?: string;
}

export interface AppSettings {
  id: 'default';
  theme: ThemeMode;
  reducedMotion: boolean;
  hapticsEnabled: boolean;
  starterSeededVersion: number;
  setupWizard: SetupWizardState;
  updatedAt: string;
}

export interface ExportBundleV1 {
  schemaVersion: 1;
  app: 'ag-pocket';
  exportedAt: string;
  data: {
    projects: Project[];
    prompts: PromptTemplate[];
    skills: SkillEntry[];
    workflows: WorkflowEntry[];
    tasks: TaskItem[];
    activityLog: ActivityLogEntry[];
    settings: AppSettings[];
    promptDrafts: PromptDraft[];
  };
}

export interface EntityCounts {
  projects: number;
  prompts: number;
  skills: number;
  workflows: number;
  tasks: number;
  activityLog: number;
  settings: number;
  promptDrafts: number;
}

export interface ImportResult {
  ok: boolean;
  importedCounts: EntityCounts;
  skippedDuplicates: EntityCounts;
  errors: string[];
}

export interface OfficialIntegrationCapabilities {
  enabled: false;
  reason: string;
  permittedActions: readonly string[];
}

export interface OfficialIntegrationAdapter {
  readonly id: string;
  readonly enabled: false;
  readonly statusReason: string;
  getCapabilities(): OfficialIntegrationCapabilities;
  connect(): Promise<never>;
  getLiveStatus(): Promise<never>;
  submitPrompt(): Promise<never>;
}

/**
 * Computes connection readiness strictly from locally persisted state.
 * Never probes remote endpoints or claims live remote agent connectivity.
 */
export function computeConnectionReadiness(
  settings: AppSettings | undefined,
  projects: Project[]
): ConnectionReadiness {
  const hasConfiguredProjectUrl = projects.some((p) => p.officialUrl.trim().length > 0);
  if (!settings) {
    return hasConfiguredProjectUrl ? 'Remote connection not verified' : 'Not configured';
  }

  const {
    desktopRemoteControlEnabled,
    mobileLauncherVerified,
    cliReferenceReviewed,
    remoteAgentsReviewed,
  } = settings.setupWizard;

  if (desktopRemoteControlEnabled && (mobileLauncherVerified || hasConfiguredProjectUrl)) {
    return 'Ready to open';
  }

  if (desktopRemoteControlEnabled || mobileLauncherVerified || hasConfiguredProjectUrl) {
    return 'Remote connection not verified';
  }

  if (cliReferenceReviewed || remoteAgentsReviewed) {
    return 'Setup instructions available';
  }

  return 'Not configured';
}
