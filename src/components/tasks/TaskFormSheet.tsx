import { useState, type FormEvent } from "react";
import { ValidationError, tasksRepo } from "../../db/repo";
import { useAppStore } from "../../stores/useAppStore";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Project,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
} from "../../types/domain";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Sheet } from "../ui/Sheet";
import { Textarea } from "../ui/Textarea";

export interface TaskFormSheetProps {
  open: boolean;
  task?: TaskItem;
  projects: Project[];
  onClose: () => void;
}

export function TaskFormSheet({
  open,
  task,
  projects,
  onClose,
}: TaskFormSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
    >
      <TaskForm
        key={task?.id ?? "new"}
        task={task}
        projects={projects}
        onClose={onClose}
      />
    </Sheet>
  );
}

function TaskForm({
  task,
  projects,
  onClose,
}: Omit<TaskFormSheetProps, "open">) {
  const addToast = useAppStore((s) => s.addToast);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "Backlog");
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "Medium",
  );
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    const input = {
      title,
      description,
      projectId: projectId || undefined,
      status,
      priority,
      dueDate: dueDate || undefined,
      notes,
    };
    try {
      if (task) await tasksRepo.update(task.id, input);
      else await tasksRepo.create(input);
      addToast(task ? "Task updated" : "Task created", "success");
      onClose();
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.issues);
      else
        setErrors([
          err instanceof Error ? err.message : "Could not save task.",
        ]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      {errors.length > 0 ? (
        <ul
          role="alert"
          className="list-disc space-y-0.5 pl-5 text-sm text-[var(--status-danger)]"
        >
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      <Select
        label="Project"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-1 gap-3.5 min-[400px]:grid-cols-2">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          {TASK_PRIORITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Due date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />
      {task ? (
        <p className="text-xs text-[var(--text-muted)]">
          Created {new Date(task.createdAt).toLocaleString()} · Updated{" "}
          {new Date(task.updatedAt).toLocaleString()}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {task ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
