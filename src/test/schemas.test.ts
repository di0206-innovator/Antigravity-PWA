import { describe, expect, it } from 'vitest';
import {
  ActivityLogEntrySchema,
  AppSettingsSchema,
  ExportBundleV1Schema,
  ProjectInputSchema,
  ProjectSchema,
  PromptTemplateInputSchema,
  PromptTemplateSchema,
  SkillEntrySchema,
  SkillInputSchema,
  TaskInputSchema,
  TaskItemSchema,
  WorkflowEntrySchema,
  WorkflowInputSchema,
  formatZodIssues,
} from '../db/schemas';

describe('Zod schemas validation', () => {
  const now = '2026-11-25T05:00:00.000Z';

  it('accepts valid domain entities and export bundle', () => {
    const project = {
      id: 'proj-1',
      title: 'AG Pocket',
      category: 'Web Development' as const,
      machineName: 'MacBook Pro',
      workspaceLabel: 'antigravity-pwa',
      officialUrl: 'https://antigravity.google.com/r/abc123',
      description: 'Mobile companion PWA',
      notes: 'Keep official-first',
      pinned: true,
      createdAt: now,
      updatedAt: now,
    };
    expect(ProjectSchema.safeParse(project).success).toBe(true);
    expect(ProjectInputSchema.safeParse({ title: 'Test', category: 'AI / ML' }).success).toBe(true);

    const prompt = {
      id: 'prompt-1',
      title: 'Audit',
      body: 'Review {{project_name}}',
      tags: ['audit'],
      variables: ['project_name'],
      isStarter: false,
      createdAt: now,
      updatedAt: now,
    };
    expect(PromptTemplateSchema.safeParse(prompt).success).toBe(true);

    const skill = {
      id: 'skill-1',
      name: 'Hallmark',
      category: 'Design' as const,
      description: 'Design system',
      instructions: 'Apply clean visual hierarchy.',
      samplePrompt: 'Polish UI',
      tags: ['design'],
      isFavorite: true,
      isStarter: true,
      createdAt: now,
      updatedAt: now,
    };
    expect(SkillEntrySchema.safeParse(skill).success).toBe(true);

    const workflow = {
      id: 'wf-1',
      title: 'Release Flow',
      description: 'Ship safely',
      category: 'Release Engineering' as const,
      steps: ['Typecheck', 'Test', 'Build'],
      relatedSkills: ['Testing and QA'],
      copyablePrompt: 'Run release checks',
      tags: ['release'],
      isStarter: true,
      createdAt: now,
      updatedAt: now,
    };
    expect(WorkflowEntrySchema.safeParse(workflow).success).toBe(true);

    const task = {
      id: 'task-1',
      title: 'Verify manifest',
      description: 'Check icons',
      projectId: 'proj-1',
      status: 'In Progress' as const,
      priority: 'High' as const,
      dueDate: '2026-12-01',
      notes: 'Personal task',
      createdAt: now,
      updatedAt: now,
    };
    expect(TaskItemSchema.safeParse(task).success).toBe(true);

    const settings = {
      id: 'default' as const,
      theme: 'dark' as const,
      reducedMotion: false,
      hapticsEnabled: true,
      starterSeededVersion: 1,
      setupWizard: {
        desktopRemoteControlEnabled: true,
        mobileLauncherVerified: false,
        cliReferenceReviewed: true,
        remoteAgentsReviewed: false,
      },
      updatedAt: now,
    };
    expect(AppSettingsSchema.safeParse(settings).success).toBe(true);

    const bundle = {
      schemaVersion: 1 as const,
      app: 'ag-pocket' as const,
      exportedAt: now,
      data: {
        projects: [project],
        prompts: [prompt],
        skills: [skill],
        workflows: [workflow],
        tasks: [task],
        activityLog: [],
        settings: [settings],
        promptDrafts: [],
      },
    };
    expect(ExportBundleV1Schema.safeParse(bundle).success).toBe(true);
  });

  it('rejects unsafe officialUrl values, missing titles, and invalid enums', () => {
    const badUrl = ProjectInputSchema.safeParse({
      title: 'Bad URL Project',
      category: 'Other',
      officialUrl: 'javascript:alert(1)',
    });
    expect(badUrl.success).toBe(false);
    if (!badUrl.success) {
      expect(formatZodIssues(badUrl.error).join(' ')).toMatch(/HTTPS/i);
    }

    const httpUrl = ProjectInputSchema.safeParse({
      title: 'HTTP Project',
      category: 'Other',
      officialUrl: 'http://antigravity.google.com',
    });
    expect(httpUrl.success).toBe(false);

    const badEnum = ProjectInputSchema.safeParse({
      title: '',
      category: 'UnknownCategory',
    });
    expect(badEnum.success).toBe(false);
  });

  it('rejects control-character-only required strings and strips unsafe control chars on valid inputs', () => {
    const ctrlOnly = '\u0001\u0002\u0007\u001F';
    const baseMeta = { id: 'id-1', createdAt: now, updatedAt: now };

    expect(
      ProjectSchema.safeParse({
        ...baseMeta,
        title: ctrlOnly,
        category: 'Other',
        machineName: '',
        workspaceLabel: '',
        officialUrl: '',
        description: '',
        notes: '',
        pinned: false,
      }).success
    ).toBe(false);
    expect(ProjectInputSchema.safeParse({ title: ctrlOnly, category: 'Other' }).success).toBe(false);

    expect(
      PromptTemplateSchema.safeParse({
        ...baseMeta,
        title: ctrlOnly,
        body: 'Valid body',
        tags: [],
        variables: [],
        isStarter: false,
      }).success
    ).toBe(false);
    expect(
      PromptTemplateSchema.safeParse({
        ...baseMeta,
        title: 'Valid title',
        body: ctrlOnly,
        tags: [],
        variables: [],
        isStarter: false,
      }).success
    ).toBe(false);
    expect(
      PromptTemplateInputSchema.safeParse({ title: ctrlOnly, body: 'Valid body' }).success
    ).toBe(false);
    expect(
      PromptTemplateInputSchema.safeParse({ title: 'Valid title', body: ctrlOnly }).success
    ).toBe(false);

    expect(
      SkillEntrySchema.safeParse({
        ...baseMeta,
        name: ctrlOnly,
        category: 'Testing',
        description: '',
        instructions: 'Valid instructions',
        samplePrompt: '',
        tags: [],
        isFavorite: false,
        isStarter: false,
      }).success
    ).toBe(false);
    expect(
      SkillEntrySchema.safeParse({
        ...baseMeta,
        name: 'Valid skill',
        category: 'Testing',
        description: '',
        instructions: ctrlOnly,
        samplePrompt: '',
        tags: [],
        isFavorite: false,
        isStarter: false,
      }).success
    ).toBe(false);
    expect(
      SkillInputSchema.safeParse({
        name: ctrlOnly,
        category: 'Testing',
        instructions: 'Valid instructions',
      }).success
    ).toBe(false);
    expect(
      SkillInputSchema.safeParse({
        name: 'Valid skill',
        category: 'Testing',
        instructions: ctrlOnly,
      }).success
    ).toBe(false);

    expect(
      WorkflowEntrySchema.safeParse({
        ...baseMeta,
        title: ctrlOnly,
        description: '',
        category: 'Development',
        steps: ['Step 1'],
        relatedSkills: [],
        copyablePrompt: '',
        tags: [],
        isStarter: false,
      }).success
    ).toBe(false);
    expect(
      WorkflowEntrySchema.safeParse({
        ...baseMeta,
        title: 'Valid workflow',
        description: '',
        category: 'Development',
        steps: [ctrlOnly],
        relatedSkills: [],
        copyablePrompt: '',
        tags: [],
        isStarter: false,
      }).success
    ).toBe(false);
    expect(
      WorkflowInputSchema.safeParse({
        title: 'Valid workflow',
        category: 'Development',
        steps: [ctrlOnly],
      }).success
    ).toBe(false);

    expect(
      TaskItemSchema.safeParse({
        ...baseMeta,
        title: ctrlOnly,
        description: '',
        status: 'Planned',
        priority: 'Medium',
        notes: '',
      }).success
    ).toBe(false);
    expect(TaskInputSchema.safeParse({ title: ctrlOnly }).success).toBe(false);

    expect(
      ActivityLogEntrySchema.safeParse({
        id: 'act-1',
        timestamp: now,
        category: 'system',
        description: ctrlOnly,
      }).success
    ).toBe(false);

    const cleanedProject = ProjectInputSchema.parse({
      title: '  \u0001Clean\u0002 Title  ',
      category: 'Other',
    });
    expect(cleanedProject.title).toBe('Clean Title');
  });
});
