import type { TaskItem } from "../../types/domain";

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isOverdue(task: TaskItem): boolean {
  return (
    !!task.dueDate && task.status !== "Completed" && task.dueDate < todayISO()
  );
}
