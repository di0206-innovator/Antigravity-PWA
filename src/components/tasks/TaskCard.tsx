import { Pencil, Trash2 } from "lucide-react";
import {
  TASK_STATUSES,
  type Project,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
} from "../../types/domain";
import { isOverdue } from "./taskUtils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

const PRIORITY_TONE: Record<
  TaskPriority,
  "neutral" | "info" | "warning" | "danger"
> = {
  Low: "neutral",
  Medium: "info",
  High: "warning",
  Critical: "danger",
};

export interface TaskCardProps {
  task: TaskItem;
  project?: Project;
  onEdit: (t: TaskItem) => void;
  onDelete: (t: TaskItem) => void;
  onStatus: (t: TaskItem, s: TaskStatus) => void;
}

export function TaskCard({
  task,
  project,
  onEdit,
  onDelete,
  onStatus,
}: TaskCardProps) {
  const overdue = isOverdue(task);
  return (
    <article
      data-testid="task-card"
      data-overdue={overdue ? "true" : undefined}
      className={`min-w-0 space-y-2.5 rounded-xl border p-3.5 ${
        overdue
          ? "border-[var(--status-danger)]/60 bg-[var(--status-danger-bg)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold">
          {task.title}
        </h3>
        <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
      </div>
      {task.description ? (
        <p className="line-clamp-2 break-words text-sm text-[var(--text-secondary)]">
          {task.description}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {project ? <Badge tone="violet">{project.title}</Badge> : null}
        {task.dueDate ? (
          <Badge tone={overdue ? "danger" : "neutral"}>
            {overdue ? "Overdue · " : "Due "}
            {task.dueDate}
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Created {new Date(task.createdAt).toLocaleDateString()} · Updated{" "}
        {new Date(task.updatedAt).toLocaleDateString()}
      </p>
      <Select
        aria-label={`Status for ${task.title}`}
        value={task.status}
        onChange={(e) => onStatus(task, e.target.value as TaskStatus)}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(task)}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </Button>
      </div>
    </article>
  );
}
