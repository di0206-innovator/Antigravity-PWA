import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eraser, ExternalLink, Eye, FileText, Pencil, Save } from 'lucide-react';
import { logActivity } from '../db/activityService';
import { db } from '../db/database';
import { promptsRepo } from '../db/repo';
import { useHaptics } from '../hooks/useHaptics';
import { useLive } from '../hooks/useLive';
import {
  OFFICIAL_ANTIGRAVITY_BASE_URL,
  extractTemplateVariables,
  interpolatePromptVariables,
  openOfficialUrl,
  sanitizePlainText,
} from '../services/security';
import { useAppStore } from '../stores/useAppStore';
import type { PromptDraft, PromptTemplate } from '../types/domain';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { TemplateSheet } from '../components/prompts/TemplateSheet';
import { copyText, countWords, humanizeVariable } from '../components/prompts/promptUtils';

const STANDARD_VARIABLES = [
  'project_name',
  'task_description',
  'tech_stack',
  'requirements',
  'constraints',
  'skills_to_use',
] as const;

export function PromptStudioPage() {
  const addToast = useAppStore((s) => s.addToast);
  const pendingInjection = useAppStore((s) => s.pendingPromptInjection);
  const consumePromptInjection = useAppStore((s) => s.consumePromptInjection);
  const quickAction = useAppStore((s) => s.quickActionTrigger);
  const clearQuickAction = useAppStore((s) => s.clearQuickAction);
  const { triggerHaptic } = useHaptics();

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();
  const [showPreview, setShowPreview] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const dirtyRef = useRef(false);
  const latestDraftRef = useRef<Omit<PromptDraft, 'id' | 'updatedAt'>>({
    title: '',
    body: '',
    tags: [],
    variableValues: {},
  });
  const autosaveTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  const { data: projects, error: projectsError } = useLive(
    () => db.projects.orderBy('title').toArray(),
    []
  );
  const { data: activeTemplate } = useLive(
    () => (templateId ? db.prompts.get(templateId) : undefined),
    [templateId]
  );

  const validProjectId = useMemo(() => {
    if (!projectId) return undefined;
    if (projects && !projects.some((p) => p.id === projectId)) return undefined;
    return projectId;
  }, [projects, projectId]);

  const selectedProject = useMemo(
    () => (projects ?? []).find((p) => p.id === validProjectId),
    [projects, validProjectId]
  );
  const reviewTargetUrl = selectedProject?.officialUrl || OFFICIAL_ANTIGRAVITY_BASE_URL;

  useEffect(() => {
    latestDraftRef.current = {
      title,
      body,
      tags,
      variableValues: values,
      selectedTemplateId: templateId,
      selectedProjectId: validProjectId,
    };
  }, [title, body, tags, values, templateId, validProjectId]);

  // Restore draft once.
  useEffect(() => {
    let cancelled = false;
    void promptsRepo
      .getDraft()
      .then((d) => {
        if (cancelled) return;
        setTitle(d.title);
        setBody(d.body);
        setTags(d.tags ?? []);
        setValues(d.variableValues ?? {});
        setTemplateId(d.selectedTemplateId);
        setProjectId(d.selectedProjectId);
      })
      .catch(() => addToast('Could not restore your draft.', 'warning'))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  // Debounced autosave (only after user edits/changes, not on initial hydration).
  useEffect(() => {
    if (!loaded || !dirtyRef.current) return;
    const snapshot: Omit<PromptDraft, 'id' | 'updatedAt'> = {
      title,
      body,
      tags,
      variableValues: values,
      selectedTemplateId: templateId,
      selectedProjectId: validProjectId,
    };
    const h = window.setTimeout(() => {
      dirtyRef.current = false;
      void promptsRepo.saveDraft(snapshot).catch(() => {
        addToast('Could not autosave your prompt draft.', 'warning');
      });
    }, 500);
    autosaveTimerRef.current = h;
    return () => {
      window.clearTimeout(h);
      if (autosaveTimerRef.current === h) {
        autosaveTimerRef.current = null;
      }
    };
  }, [loaded, title, body, tags, values, templateId, validProjectId, addToast]);

  // Clear timers and flush pending dirty draft on unmount.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        void promptsRepo.saveDraft(latestDraftRef.current).catch(() => undefined);
      }
    };
  }, []);

  // Pending injections from other pages (syncs external store into local editor state).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loaded || !pendingInjection) return;
    const inj = consumePromptInjection();
    if (!inj) return;
    const text = sanitizePlainText(inj.body);
    const nextBody = inj.mode === 'append' ? (body.trim() ? `${body}\n\n${text}` : text) : text;
    const nextTitle =
      inj.mode === 'append'
        ? title.trim()
          ? title
          : inj.title
            ? sanitizePlainText(inj.title, 160)
            : title
        : inj.title
          ? sanitizePlainText(inj.title, 160)
          : title;
    const nextTags = inj.tags?.length
      ? Array.from(new Set([...tags, ...inj.tags])).slice(0, 30)
      : tags;
    const nextTemplateId = inj.mode === 'replace' ? undefined : templateId;

    dirtyRef.current = false;
    setBody(nextBody);
    setTitle(nextTitle);
    setTags(nextTags);
    setTemplateId(nextTemplateId);
    setShowPreview(false);
    setHasCopied(false);
    setConfirmClear(false);

    void promptsRepo
      .saveDraft({
        title: nextTitle,
        body: nextBody,
        tags: nextTags,
        variableValues: values,
        selectedTemplateId: nextTemplateId,
        selectedProjectId: validProjectId,
      })
      .catch(() => addToast('Could not save injected prompt draft.', 'warning'));

    addToast('Added to Prompt Studio', 'success');
    editorRef.current?.focus();
  }, [
    loaded,
    pendingInjection,
    consumePromptInjection,
    addToast,
    body,
    title,
    tags,
    values,
    templateId,
    validProjectId,
  ]);

  // Quick action: fresh editor.
  useEffect(() => {
    if (!loaded || quickAction?.action !== 'new_prompt') return;
    dirtyRef.current = false;
    setTitle('');
    setBody('');
    setTags([]);
    setValues({});
    setTemplateId(undefined);
    setProjectId(undefined);
    setShowPreview(false);
    setHasCopied(false);
    setConfirmClear(false);
    clearQuickAction();
    void promptsRepo.clearDraft().catch(() => undefined);
    editorRef.current?.focus();
  }, [loaded, quickAction, clearQuickAction]);

  /* eslint-enable react-hooks/set-state-in-effect */

  const variables = useMemo(() => extractTemplateVariables(body), [body]);
  const finalText = useMemo(() => interpolatePromptVariables(body, values), [body, values]);
  const chars = finalText.length;
  const words = countWords(finalText);

  const flashCopied = useCallback(() => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    setCopied(true);
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setCopied(false);
    }, 2500);
  }, []);

  const handleCopy = async () => {
    if (!finalText.trim()) {
      addToast('Nothing to copy yet.', 'warning');
      return;
    }
    const ok = await copyText(finalText);
    if (!ok) {
      addToast('Could not copy. Select the text in Preview and copy manually.', 'error');
      setShowPreview(true);
      return;
    }
    triggerHaptic('success');
    flashCopied();
    setHasCopied(true);
    addToast('Copied', 'success');
    void logActivity({ category: 'prompt', description: 'Copied prompt', projectId: validProjectId }).catch(
      () => undefined
    );
  };

  const openAntigravityTarget = (url: string, activityDesc: string) => {
    triggerHaptic('medium');
    const r = openOfficialUrl(url);
    if (!r.opened) {
      addToast(r.error ?? 'Could not open Antigravity.', 'error');
      return;
    }
    void logActivity({ category: 'prompt', description: activityDesc, projectId: validProjectId }).catch(
      () => undefined
    );
  };

  const addTag = () => {
    const t = sanitizePlainText(tagInput, 48).trim();
    if (t && !tags.includes(t) && tags.length < 30) {
      dirtyRef.current = true;
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const insertVariable = (name: string) => {
    const token = `{{${name}}}`;
    const el = editorRef.current;
    dirtyRef.current = true;
    if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      window.requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange?.(pos, pos);
      });
    } else {
      setBody((b) => (b.trim() ? `${b} ${token}` : token));
      el?.focus();
    }
  };

  const saveTemplate = async (asNew: boolean) => {
    setSaveError(null);
    try {
      const input = { title, body, tags, projectId: validProjectId };
      const saved =
        !asNew && templateId ? await promptsRepo.update(templateId, input) : await promptsRepo.create(input);
      dirtyRef.current = true;
      setTemplateId(saved.id);
      addToast(!asNew && templateId ? 'Template updated' : 'Template saved', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save template.';
      setSaveError(msg);
      addToast(msg, 'error');
    }
  };

  const clearEditor = () => {
    dirtyRef.current = false;
    setTitle('');
    setBody('');
    setTags([]);
    setValues({});
    setTemplateId(undefined);
    setProjectId(undefined);
    setShowPreview(false);
    setConfirmClear(false);
    setHasCopied(false);
    void promptsRepo.clearDraft().catch(() => undefined);
    editorRef.current?.focus();
  };

  const applyTemplate = (t: PromptTemplate, mode: 'replace' | 'append') => {
    dirtyRef.current = true;
    if (mode === 'append') {
      setBody((b) => (b.trim() ? `${b}\n\n${t.body}` : t.body));
    } else {
      setBody(t.body);
      setTitle(t.title);
      setTags(t.tags);
      setTemplateId(t.id);
      setValues({});
      setProjectId(t.projectId);
    }
    setHasCopied(false);
    setConfirmClear(false);
    setSheetOpen(false);
    addToast(mode === 'append' ? 'Template appended' : 'Template inserted', 'success');
  };

  const onEditorFocus = () => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      focusTimerRef.current = null;
      editorRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 300);
  };

  return (
    <div className="space-y-4 min-w-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Prompt Studio</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Compose and copy prompts locally. AG Pocket never submits prompts automatically.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTemplate ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs">
              <span className="min-w-0 break-words text-[var(--text-secondary)]">
                Editing template: <strong className="text-[var(--text-primary)]">{activeTemplate.title}</strong>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  dirtyRef.current = true;
                  setTemplateId(undefined);
                }}
              >
                Detach
              </Button>
            </div>
          ) : null}

          <Input
            label="Title"
            value={title}
            maxLength={160}
            onChange={(e) => {
              dirtyRef.current = true;
              setTitle(e.target.value);
            }}
            placeholder="Untitled prompt"
          />
          <Textarea
            ref={editorRef}
            label="Prompt"
            value={body}
            maxLength={50000}
            onChange={(e) => {
              dirtyRef.current = true;
              setBody(e.target.value);
            }}
            onFocus={onEditorFocus}
            placeholder="Write your prompt. Use {{variable_name}} for fill-in values."
            className="min-h-[240px] scroll-mb-40 font-mono text-base sm:text-sm leading-relaxed resize-y"
          />
          <p className="text-xs text-[var(--text-muted)]" aria-live="polite">
            {words} words · {chars} characters
          </p>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--text-muted)]">Insert variable</span>
            <div className="flex flex-wrap gap-1.5">
              {STANDARD_VARIABLES.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Insert variable ${v}`}
                  onClick={() => insertVariable(v)}
                >
                  {`{{${v}}}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <Input
                label="Add tag"
                value={tagInput}
                maxLength={48}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button variant="secondary" onClick={addTag} aria-label="Add tag to prompt">
                Add
              </Button>
            </div>
            {tags.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                {tags.map((t) => (
                  <li key={t}>
                    <Badge className="min-h-[44px] py-0 pl-3 pr-0 gap-1">
                      <span>{t}</span>
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-[var(--bg-surface)] cursor-pointer"
                        onClick={() => {
                          dirtyRef.current = true;
                          setTags(tags.filter((x) => x !== t));
                        }}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <Select
            label="Associated project (optional)"
            value={validProjectId ?? ''}
            onChange={(e) => {
              const nextId = e.target.value || undefined;
              dirtyRef.current = true;
              setProjectId(nextId);
              if (nextId) {
                const chosen = (projects ?? []).find((p) => p.id === nextId);
                if (chosen && !(values.project_name ?? '').trim()) {
                  setValues((prev) => ({ ...prev, project_name: chosen.title }));
                }
              }
            }}
          >
            <option value="">No project</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          {projectsError ? (
            <p role="alert" className="text-xs text-[var(--status-danger)]">
              Could not load projects list.
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="text-sm text-[var(--status-danger)]">
              {saveError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {variables.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Fill variables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {variables.map((v) => (
              <div key={v} className="space-y-1.5">
                <Textarea
                  label={humanizeVariable(v)}
                  value={values[v] ?? ''}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setValues({ ...values, [v]: e.target.value });
                  }}
                  className="min-h-[64px]"
                  rows={2}
                />
                {v === 'project_name' && selectedProject && !(values.project_name ?? '').trim() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      dirtyRef.current = true;
                      setValues({ ...values, project_name: selectedProject.title });
                    }}
                  >
                    Use &ldquo;{selectedProject.title}&rdquo;
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {showPreview ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              aria-label="Final prompt preview"
              data-testid="prompt-preview"
              className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-xl bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-primary)] font-mono max-h-[50dvh] overflow-y-auto"
            >
              {finalText || 'Nothing to preview yet.'}
            </pre>
            {variables.some((v) => !(values[v] ?? '').trim()) ? (
              <p className="mt-2 text-xs text-[var(--status-warn)]">
                Some variables are unfilled and will stay as {'{{placeholders}}'}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {hasCopied ? (
        <DisclosureBanner
          variant="warning"
          title="Prompt copied"
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  openAntigravityTarget(
                    OFFICIAL_ANTIGRAVITY_BASE_URL,
                    'Opened Antigravity after copying prompt'
                  )
                }
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open Antigravity
              </Button>
              <Button
                onClick={() =>
                  openAntigravityTarget(
                    reviewTargetUrl,
                    'Opened Antigravity to review copied prompt'
                  )
                }
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open Antigravity to Review
              </Button>
            </div>
          }
        >
          AG Pocket never submits prompts. Paste and submit it manually in the official Antigravity interface.
        </DisclosureBanner>
      ) : null}

      <div className="md:sticky md:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 mx-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 p-2 backdrop-blur-md">
        {confirmClear ? (
          <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm clear">
            <span className="text-sm text-[var(--text-primary)] min-w-0">Clear the editor and draft?</span>
            <Button variant="danger" onClick={clearEditor}>
              Yes, clear
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleCopy()} className="flex-1 min-w-[8rem]">
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy prompt'}
            </Button>
            <Button variant="secondary" onClick={() => setShowPreview((s) => !s)} aria-pressed={showPreview}>
              <Eye className="h-4 w-4" aria-hidden="true" /> Preview
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              <FileText className="h-4 w-4" aria-hidden="true" /> Templates
            </Button>
            <Button variant="secondary" onClick={() => void saveTemplate(true)}>
              <Save className="h-4 w-4" aria-hidden="true" /> Save as template
            </Button>
            {templateId ? (
              <Button variant="secondary" onClick={() => void saveTemplate(false)}>
                <Pencil className="h-4 w-4" aria-hidden="true" /> Update template
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setConfirmClear(true)}>
              <Eraser className="h-4 w-4" aria-hidden="true" /> Clear
            </Button>
          </div>
        )}
        <span className="sr-only" role="status">
          {copied ? 'Copied' : ''}
        </span>
      </div>

      <TemplateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUse={applyTemplate}
        onEdit={(t) => {
          applyTemplate(t, 'replace');
        }}
        onDeleted={(id) => {
          if (id === templateId) {
            dirtyRef.current = true;
            setTemplateId(undefined);
          }
        }}
      />
    </div>
  );
}
