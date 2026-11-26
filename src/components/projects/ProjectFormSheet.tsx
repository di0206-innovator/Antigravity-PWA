import { useEffect, useRef, useState, type FormEvent } from "react";
import { ValidationError, projectsRepo } from "../../db/repo";
import { sanitizePlainText, validateOfficialAntigravityUrl } from "../../services/security";
import { useAppStore } from "../../stores/useAppStore";
import {
  PROJECT_CATEGORIES,
  type Project,
  type ProjectCategory,
} from "../../types/domain";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Sheet } from "../ui/Sheet";
import { Textarea } from "../ui/Textarea";

interface Props {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSaved?: (p: Project) => void;
}

interface FormState {
  title: string;
  category: ProjectCategory;
  machineName: string;
  workspaceLabel: string;
  officialUrl: string;
  description: string;
  notes: string;
  pinned: boolean;
}

const EMPTY: FormState = {
  title: "",
  category: "Other",
  machineName: "",
  workspaceLabel: "",
  officialUrl: "",
  description: "",
  notes: "",
  pinned: false,
};

function initialFormState(project?: Project | null): FormState {
  if (!project) return EMPTY;
  return {
    title: project.title,
    category: project.category,
    machineName: project.machineName,
    workspaceLabel: project.workspaceLabel,
    officialUrl: project.officialUrl,
    description: project.description,
    notes: project.notes,
    pinned: project.pinned,
  };
}

export function ProjectFormSheet({ open, project, onClose, onSaved }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description="Stored locally on this device. Not synced with Antigravity."
    >
      <ProjectForm
        key={project?.id ?? "new"}
        project={project}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Sheet>
  );
}

function ProjectForm({ project, onClose, onSaved }: Omit<Props, "open">) {
  const addToast = useAppStore((s) => s.addToast);
  const [form, setForm] = useState<FormState>(() => initialFormState(project));
  const [touchedUrl, setTouchedUrl] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const urlCheck = validateOfficialAntigravityUrl(form.officialUrl, {
    allowEmpty: true,
  });
  const urlError =
    (touchedUrl || submitted || form.officialUrl.length > 0) && !urlCheck.valid
      ? urlCheck.error
      : undefined;
  const cleanTitle = sanitizePlainText(form.title).trim();
  const titleError =
    submitted && !cleanTitle ? "Project title is required." : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setErrors([]);
    if (!cleanTitle || !urlCheck.valid) return;
    setSaving(true);
    try {
      const input = { ...form, officialUrl: urlCheck.normalizedUrl ?? "" };
      const saved = project
        ? await projectsRepo.update(project.id, input)
        : await projectsRepo.create(input);
      addToast(project ? "Project updated." : "Project created.", "success");
      if (mountedRef.current) setSaving(false);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (!mountedRef.current) return;
      setSaving(false);
      if (err instanceof ValidationError) setErrors(err.issues);
      else
        setErrors([
          err instanceof Error ? err.message : "Could not save project.",
        ]);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label="Title"
        value={form.title}
        maxLength={140}
        required
        error={titleError}
        onChange={(e) => set("title", e.target.value)}
      />
      <Select
        label="Category"
        value={form.category}
        onChange={(e) => set("category", e.target.value as ProjectCategory)}
      >
        {PROJECT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Input
        label="Machine name"
        value={form.machineName}
        maxLength={120}
        onChange={(e) => set("machineName", e.target.value)}
      />
      <Input
        label="Workspace label"
        value={form.workspaceLabel}
        maxLength={160}
        onChange={(e) => set("workspaceLabel", e.target.value)}
      />
      <Input
        label="Official Antigravity session URL"
        type="url"
        inputMode="url"
        autoComplete="off"
        maxLength={2048}
        placeholder="https://antigravity.google.com/..."
        hint="Optional. Must be an https://antigravity.google.com address."
        value={form.officialUrl}
        error={urlError}
        onBlur={() => setTouchedUrl(true)}
        onChange={(e) => set("officialUrl", e.target.value)}
      />
      <Textarea
        label="Description"
        value={form.description}
        maxLength={4000}
        onChange={(e) => set("description", e.target.value)}
      />
      <Textarea
        label="Notes"
        value={form.notes}
        maxLength={20000}
        onChange={(e) => set("notes", e.target.value)}
      />
      <label className="touch-target flex items-center gap-3 text-sm font-medium cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={form.pinned}
          onChange={(e) => set("pinned", e.target.checked)}
        />
        Pin this project
      </label>
      {errors.length > 0 ? (
        <ul
          role="alert"
          className="list-disc pl-5 text-sm text-[var(--status-danger)]"
        >
          {errors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
