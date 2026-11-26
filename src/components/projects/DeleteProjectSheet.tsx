import { useEffect, useRef, useState } from "react";
import { projectsRepo } from "../../db/repo";
import { useAppStore } from "../../stores/useAppStore";
import type { Project } from "../../types/domain";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

interface Props {
  project: Project | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteProjectSheet({ project, onClose, onDeleted }: Props) {
  const addToast = useAppStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!project) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Delete project?"
      description="This cannot be undone."
    >
      <p className="mb-4 break-words text-sm text-[var(--text-secondary)]">
        Delete &ldquo;{project.title}&rdquo; from this device? Linked tasks and
        prompts are kept but detached from the project.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await projectsRepo.remove(project.id);
              addToast("Project deleted.", "success");
              if (mountedRef.current) setBusy(false);
              onDeleted?.();
              onClose();
            } catch (e) {
              if (mountedRef.current) setBusy(false);
              addToast(
                e instanceof Error ? e.message : "Could not delete project.",
                "error",
              );
            }
          }}
        >
          Delete project
        </Button>
      </div>
    </Sheet>
  );
}
