import { PROJECT_CATEGORIES, type Project } from "../../types/domain";

const PALETTE = [
  "#4f8cff",
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#06b6d4",
  "#f97316",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic accent colour derived from title + category. */
export function projectColor(p: Pick<Project, "title" | "category">): string {
  return PALETTE[hash(`${p.category}:${p.title}`) % PALETTE.length];
}

export function projectInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const s =
    words.length > 1
      ? words[0][0] + words[1][0]
      : (words[0] ?? "?").slice(0, 2);
  return s.toUpperCase();
}

export function sortProjects(list: Project[]): Project[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "unknown"
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function buildProjectContext(p: Project): string {
  const lines = [`Project: ${p.title}`, `Category: ${p.category}`];
  if (p.machineName) lines.push(`Machine: ${p.machineName}`);
  if (p.workspaceLabel) lines.push(`Workspace: ${p.workspaceLabel}`);
  if (p.description) lines.push(`Description: ${p.description}`);
  if (p.notes) lines.push(`Notes: ${p.notes}`);
  return lines.join("\n");
}

export { PROJECT_CATEGORIES };
