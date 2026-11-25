import type { Project } from "../../types/domain";
import { projectColor, projectInitials } from "./projectUtils";

export function ProjectAvatar({
  project,
}: {
  project: Pick<Project, "title" | "category">;
}) {
  const c = projectColor(project);
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
      style={{
        backgroundColor: `${c}26`,
        color: c,
        border: `1px solid ${c}66`,
      }}
    >
      {projectInitials(project.title)}
    </span>
  );
}
