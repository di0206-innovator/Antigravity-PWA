import {
  ProjectInputSchema,
  PromptDraftSchema,
  PromptTemplateInputSchema,
  SkillInputSchema,
  TaskInputSchema,
  WorkflowInputSchema,
} from './schemas';
import type { z } from 'zod';
import type {
  Project,
  PromptDraft,
  PromptTemplate,
  SkillEntry,
  TaskItem,
  WorkflowEntry,
} from '../types/domain';
import { extractTemplateVariables, sanitizePlainText } from '../services/security';
import { AGPocketDB, createEmptyPromptDraft, db, generateEntityId, withDbErrorHandling } from './database';
import { logActivity } from './activityService';

/** Thrown for user-correctable validation problems; message is safe to show in the UI. */
export class ValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues.join(' '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (!res.success) {
    throw new ValidationError(res.error.issues.map((i) => i.message));
  }
  return res.data;
}

const now = () => new Date().toISOString();

export type ProjectInput = z.input<typeof ProjectInputSchema>;
export type PromptInput = z.input<typeof PromptTemplateInputSchema>;
export type SkillInput = z.input<typeof SkillInputSchema>;
export type WorkflowInput = z.input<typeof WorkflowInputSchema>;
export type TaskInput = z.input<typeof TaskInputSchema>;

// ---------- Projects ----------
export const projectsRepo = {
  async create(input: ProjectInput, d: AGPocketDB = db): Promise<Project> {
    const data = parse(ProjectInputSchema, input);
    return withDbErrorHandling('Create project', async () => {
      const t = now();
      const p: Project = { id: generateEntityId(), ...data, createdAt: t, updatedAt: t };
      await d.transaction('rw', [d.projects, d.activityLog], async () => {
        await d.projects.add(p);
        await logActivity({ category: 'project', description: `Created project "${p.title}"`, projectId: p.id }, d);
      });
      return p;
    });
  },
  async update(id: string, input: ProjectInput, d: AGPocketDB = db): Promise<Project> {
    const data = parse(ProjectInputSchema, input);
    return withDbErrorHandling('Update project', async () => {
      return d.transaction('rw', [d.projects, d.activityLog], async () => {
        const existing = await d.projects.get(id);
        if (!existing) throw new ValidationError(['Project no longer exists.']);
        const p: Project = { ...existing, ...data, updatedAt: now() };
        await d.projects.put(p);
        await logActivity({ category: 'project', description: `Updated project "${p.title}"`, projectId: p.id }, d);
        return p;
      });
    });
  },
  async setPinned(id: string, pinned: boolean, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Pin project', async () => {
      await d.transaction('rw', [d.projects, d.activityLog], async () => {
        const p = await d.projects.get(id);
        if (!p) return;
        await d.projects.update(id, { pinned, updatedAt: now() });
        await logActivity(
          { category: 'project', description: `${pinned ? 'Pinned' : 'Unpinned'} project "${p.title}"`, projectId: id },
          d
        );
      });
    });
  },
  async remove(id: string, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Delete project', async () => {
      await d.transaction('rw', [d.projects, d.tasks, d.prompts, d.promptDrafts, d.activityLog], async () => {
        const p = await d.projects.get(id);
        if (!p) return;
        await d.projects.delete(id);
        // Detach (never delete) related records.
        const tasks = await d.tasks.where('projectId').equals(id).toArray();
        for (const t of tasks) await d.tasks.update(t.id, { projectId: undefined });
        const prompts = await d.prompts.where('projectId').equals(id).toArray();
        for (const pr of prompts) await d.prompts.update(pr.id, { projectId: undefined });
        const draft = await d.promptDrafts.get('active');
        if (draft?.selectedProjectId === id) {
          await d.promptDrafts.update('active', { selectedProjectId: undefined, updatedAt: now() });
        }
        await logActivity({ category: 'project', description: `Deleted project "${p.title}"` }, d);
      });
    });
  },
};

// ---------- Prompts ----------
export const promptsRepo = {
  async create(input: PromptInput, d: AGPocketDB = db): Promise<PromptTemplate> {
    const data = parse(PromptTemplateInputSchema, input);
    return withDbErrorHandling('Save prompt template', async () => {
      const t = now();
      const p: PromptTemplate = {
        id: generateEntityId(),
        ...data,
        variables: extractTemplateVariables(data.body),
        isStarter: false,
        createdAt: t,
        updatedAt: t,
      };
      await d.transaction('rw', [d.prompts, d.activityLog], async () => {
        await d.prompts.add(p);
        await logActivity({ category: 'prompt', description: `Added prompt template "${p.title}"`, projectId: p.projectId }, d);
      });
      return p;
    });
  },
  async update(id: string, input: PromptInput, d: AGPocketDB = db): Promise<PromptTemplate> {
    const data = parse(PromptTemplateInputSchema, input);
    return withDbErrorHandling('Update prompt template', async () => {
      return d.transaction('rw', [d.prompts, d.activityLog], async () => {
        const existing = await d.prompts.get(id);
        if (!existing) throw new ValidationError(['Template no longer exists.']);
        const p: PromptTemplate = {
          ...existing,
          ...data,
          variables: extractTemplateVariables(data.body),
          updatedAt: now(),
        };
        await d.prompts.put(p);
        await logActivity(
          { category: 'prompt', description: `Updated prompt template "${p.title}"`, projectId: p.projectId },
          d
        );
        return p;
      });
    });
  },
  async duplicate(id: string, d: AGPocketDB = db): Promise<PromptTemplate | undefined> {
    const src = await d.prompts.get(id);
    if (!src) return undefined;
    return promptsRepo.create(
      { title: `${src.title} (copy)`.slice(0, 160), body: src.body, tags: src.tags, projectId: src.projectId },
      d
    );
  },
  async remove(id: string, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Delete prompt template', async () => {
      await d.transaction('rw', [d.prompts, d.activityLog], async () => {
        const p = await d.prompts.get(id);
        if (!p) return;
        await d.prompts.delete(id);
        await logActivity({ category: 'prompt', description: `Deleted prompt template "${p.title}"` }, d);
      });
    });
  },
  async getDraft(d: AGPocketDB = db): Promise<PromptDraft> {
    return withDbErrorHandling('Load prompt draft', async () => (await d.promptDrafts.get('active')) ?? createEmptyPromptDraft());
  },
  async saveDraft(draft: Omit<PromptDraft, 'id' | 'updatedAt'>, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Autosave prompt draft', async () => {
      const cleanTags = Array.isArray(draft.tags)
        ? draft.tags.map((t) => sanitizePlainText(t, 48).trim()).filter(Boolean).slice(0, 30)
        : [];
      const cleanVariables = Object.fromEntries(
        Object.entries(draft.variableValues ?? {})
          .map(([k, v]) => [sanitizePlainText(k, 64), sanitizePlainText(v, 10000)])
          .filter(([k]) => k.length > 0)
      );
      const cleanTemplateId = draft.selectedTemplateId
        ? sanitizePlainText(draft.selectedTemplateId, 128).trim() || undefined
        : undefined;
      const cleanProjectId = draft.selectedProjectId
        ? sanitizePlainText(draft.selectedProjectId, 128).trim() || undefined
        : undefined;

      const validated = parse(PromptDraftSchema, {
        id: 'active' as const,
        title: sanitizePlainText(draft.title ?? '', 160),
        body: sanitizePlainText(draft.body ?? '', 50000),
        tags: cleanTags,
        variableValues: cleanVariables,
        ...(cleanTemplateId ? { selectedTemplateId: cleanTemplateId } : {}),
        ...(cleanProjectId ? { selectedProjectId: cleanProjectId } : {}),
        updatedAt: now(),
      });
      await d.promptDrafts.put(validated);
    });
  },
  async clearDraft(d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Clear prompt draft', async () => {
      await d.promptDrafts.put(createEmptyPromptDraft());
    });
  },
};

// ---------- Skills ----------
export const skillsRepo = {
  async create(input: SkillInput, d: AGPocketDB = db): Promise<SkillEntry> {
    const data = parse(SkillInputSchema, input);
    return withDbErrorHandling('Create skill', async () => {
      const t = now();
      const s: SkillEntry = { id: generateEntityId(), ...data, isStarter: false, createdAt: t, updatedAt: t };
      await d.transaction('rw', [d.skills, d.activityLog], async () => {
        await d.skills.add(s);
        await logActivity({ category: 'skill', description: `Created skill entry "${s.name}"` }, d);
      });
      return s;
    });
  },
  async update(id: string, input: SkillInput, d: AGPocketDB = db): Promise<SkillEntry> {
    const data = parse(SkillInputSchema, input);
    return withDbErrorHandling('Update skill', async () => {
      return d.transaction('rw', [d.skills, d.activityLog], async () => {
        const existing = await d.skills.get(id);
        if (!existing) throw new ValidationError(['Skill no longer exists.']);
        const s: SkillEntry = { ...existing, ...data, updatedAt: now() };
        await d.skills.put(s);
        await logActivity({ category: 'skill', description: `Updated skill entry "${s.name}"` }, d);
        return s;
      });
    });
  },
  async setFavorite(id: string, isFavorite: boolean, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Favourite skill', async () => {
      await d.transaction('rw', [d.skills, d.activityLog], async () => {
        const s = await d.skills.get(id);
        if (!s) return;
        await d.skills.update(id, { isFavorite, updatedAt: now() });
        await logActivity(
          {
            category: 'skill',
            description: `${isFavorite ? 'Favourited' : 'Unfavourited'} skill entry "${s.name}"`,
          },
          d
        );
      });
    });
  },
  async remove(id: string, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Delete skill', async () => {
      await d.transaction('rw', [d.skills, d.activityLog], async () => {
        const s = await d.skills.get(id);
        if (!s) return;
        await d.skills.delete(id);
        await logActivity({ category: 'skill', description: `Deleted skill entry "${s.name}"` }, d);
      });
    });
  },
};

// ---------- Workflows ----------
export const workflowsRepo = {
  async create(input: WorkflowInput, d: AGPocketDB = db): Promise<WorkflowEntry> {
    const data = parse(WorkflowInputSchema, input);
    return withDbErrorHandling('Create workflow', async () => {
      const t = now();
      const w: WorkflowEntry = { id: generateEntityId(), ...data, isStarter: false, createdAt: t, updatedAt: t };
      await d.transaction('rw', [d.workflows, d.activityLog], async () => {
        await d.workflows.add(w);
        await logActivity({ category: 'workflow', description: `Created workflow "${w.title}"` }, d);
      });
      return w;
    });
  },
  async update(id: string, input: WorkflowInput, d: AGPocketDB = db): Promise<WorkflowEntry> {
    const data = parse(WorkflowInputSchema, input);
    return withDbErrorHandling('Update workflow', async () => {
      return d.transaction('rw', [d.workflows, d.activityLog], async () => {
        const existing = await d.workflows.get(id);
        if (!existing) throw new ValidationError(['Workflow no longer exists.']);
        const w: WorkflowEntry = { ...existing, ...data, updatedAt: now() };
        await d.workflows.put(w);
        await logActivity({ category: 'workflow', description: `Updated workflow "${w.title}"` }, d);
        return w;
      });
    });
  },
  async remove(id: string, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Delete workflow', async () => {
      await d.transaction('rw', [d.workflows, d.activityLog], async () => {
        const w = await d.workflows.get(id);
        if (!w) return;
        await d.workflows.delete(id);
        await logActivity({ category: 'workflow', description: `Deleted workflow "${w.title}"` }, d);
      });
    });
  },
};

// ---------- Tasks ----------
export const tasksRepo = {
  async create(input: TaskInput, d: AGPocketDB = db): Promise<TaskItem> {
    const data = parse(TaskInputSchema, input);
    return withDbErrorHandling('Create task', async () => {
      const t = now();
      const task: TaskItem = { id: generateEntityId(), ...data, createdAt: t, updatedAt: t };
      await d.transaction('rw', [d.tasks, d.activityLog], async () => {
        await d.tasks.add(task);
        await logActivity({ category: 'task', description: `Created task "${task.title}"`, projectId: task.projectId }, d);
      });
      return task;
    });
  },
  async update(id: string, input: TaskInput, d: AGPocketDB = db): Promise<TaskItem> {
    const data = parse(TaskInputSchema, input);
    return withDbErrorHandling('Update task', async () => {
      return d.transaction('rw', [d.tasks, d.activityLog], async () => {
        const existing = await d.tasks.get(id);
        if (!existing) throw new ValidationError(['Task no longer exists.']);
        const task: TaskItem = { ...existing, ...data, updatedAt: now() };
        await d.tasks.put(task);
        await logActivity({ category: 'task', description: `Updated task "${task.title}"`, projectId: task.projectId }, d);
        return task;
      });
    });
  },
  async setStatus(id: string, status: TaskItem['status'], d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Update task status', async () => {
      await d.transaction('rw', [d.tasks, d.activityLog], async () => {
        const task = await d.tasks.get(id);
        if (!task || task.status === status) return;
        await d.tasks.update(id, { status, updatedAt: now() });
        await logActivity(
          { category: 'task', description: `Moved task "${task.title}" to ${status}`, projectId: task.projectId },
          d
        );
      });
    });
  },
  async remove(id: string, d: AGPocketDB = db): Promise<void> {
    return withDbErrorHandling('Delete task', async () => {
      await d.transaction('rw', [d.tasks, d.activityLog], async () => {
        const task = await d.tasks.get(id);
        if (!task) return;
        await d.tasks.delete(id);
        await logActivity({ category: 'task', description: `Deleted task "${task.title}"`, projectId: task.projectId }, d);
      });
    });
  },
};
