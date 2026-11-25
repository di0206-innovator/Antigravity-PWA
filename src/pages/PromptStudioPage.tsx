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
import type { PromptTemplate } from '../types/domain';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { TemplateSheet } from '../components/prompts/TemplateSheet';
import { copyText, countWords, humanizeVariable } from '../components/prompts/promptUtils';

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

  const { data: projects } = useLive(() => db.projects.orderBy('title').toArray(), []);

  // Restore draft once.
  useEffect(() => {
    let cancelled = false;
    void promptsRepo
      .getDraft()
      .then((d) => {
        if (cancelled) return;
        setTitle(d.title);
        setBody(d.body);
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

  // Debounced autosave.
  useEffect(() => {
    if (!loaded) return;
    const h = window.setTimeout(() => {
      void promptsRepo
        .saveDraft({
          title,
          body,
          variableValues: values,
          selectedTemplateId: templateId,
          selectedProjectId: projectId,
        })
        .catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(h);
  }, [loaded, title, body, values, templateId, projectId]);

  // Pending injections from other pages (syncs external store into local editor state).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loaded || !pendingInjection) return;
    const inj = consumePromptInjection();
    if (!inj) return;
    const text = sanitizePlainText(inj.body);
    if (inj.mode === 'append') {
      setBody((b) => (b.trim() ? `${b}\n\n${text}` : text));
    } else {
      setBody(text);
      setTemplateId(undefined);
      if (inj.title) setTitle(sanitizePlainText(inj.title, 160));
    }
    if (inj.tags?.length) setTags((t) => Array.from(new Set([...t, ...inj.tags!])).slice(0, 30));
    setShowPreview(false);
    addToast('Added to Prompt Studio', 'success');
    editorRef.current?.focus();
  }, [loaded, pendingInjection, consumePromptInjection, addToast]);

  // Quick action: fresh editor.
  useEffect(() => {
    if (!loaded || quickAction?.action !== 'new_prompt') return;
    setTitle('');
    setBody('');
    setTags([]);
    setValues({});
    setTemplateId(undefined);
    setShowPreview(false);
    clearQuickAction();
    editorRef.current?.focus();
  }, [loaded, quickAction, clearQuickAction]);

  /* eslint-enable react-hooks/set-state-in-effect */

  const variables = useMemo(() => extractTemplateVariables(body), [body]);
  const finalText = useMemo(() => interpolatePromptVariables(body, values), [body, values]);
  const chars = finalText.length;
  const words = countWords(finalText);

  const flashCopied = useCallback(() => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
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
    void logActivity({ category: 'prompt', description: 'Copied prompt', projectId }).catch(() => undefined);
  };

  const addTag = () => {
    const t = sanitizePlainText(tagInput, 48).trim();
    if (t && !tags.includes(t) && tags.length < 30) setTags([...tags, t]);
    setTagInput('');
  };

  const saveTemplate = async (asNew: boolean) => {
    setSaveError(null);
    try {
      const input = { title, body, tags, projectId };
      const saved =
        !asNew && templateId ? await promptsRepo.update(templateId, input) : await promptsRepo.create(input);
      setTemplateId(saved.id);
      addToast(!asNew && templateId ? 'Template updated' : 'Template saved', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save template.';
      setSaveError(msg);
      addToast(msg, 'error');
    }
  };

  const clearEditor = () => {
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
    if (mode === 'append') {
      setBody((b) => (b.trim() ? `${b}\n\n${t.body}` : t.body));
    } else {
      setBody(t.body);
      setTitle(t.title);
      setTags(t.tags);
      setTemplateId(t.id);
      setValues({});
      if (t.projectId) setProjectId(t.projectId);
    }
    setSheetOpen(false);
    addToast(mode === 'append' ? 'Template appended' : 'Template inserted', 'success');
  };

  const onEditorFocus = () => {
    window.setTimeout(() => editorRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 300);
  };

  return (
    <div className="space-y-4 min-w-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Prompt Studio</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Compose and copy prompts. Nothing is sent anywhere from this app.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input label="Title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled prompt" />
          <Textarea
            ref={editorRef}
            label="Prompt"
            value={body}
            maxLength={50000}
            onChange={(e) => setBody(e.target.value)}
            onFocus={onEditorFocus}
            placeholder="Write your prompt. Use {{variable_name}} for fill-in values."
            className="min-h-[240px] scroll-mb-40 font-mono text-sm leading-relaxed resize-y"
          />
          <p className="text-xs text-[var(--text-muted)]" aria-live="polite">
            {words} words · {chars} characters
          </p>

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
                    <Badge>
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        className="-mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--bg-surface)] cursor-pointer"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
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
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || undefined)}
          >
            <option value="">No project</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
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
              <Textarea
                key={v}
                label={humanizeVariable(v)}
                value={values[v] ?? ''}
                onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                className="min-h-[64px]"
                rows={2}
              />
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
              className="whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-primary)] font-mono max-h-[50dvh] overflow-y-auto"
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
            <Button
              variant="secondary"
              onClick={() => {
                const r = openOfficialUrl(OFFICIAL_ANTIGRAVITY_BASE_URL);
                if (!r.opened) addToast(r.error ?? 'Could not open Antigravity.', 'error');
              }}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open Antigravity
            </Button>
          }
        >
          AG Pocket never submits prompts. Paste and submit it manually in the official Antigravity interface.
        </DisclosureBanner>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 -mx-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 p-2 backdrop-blur-md">
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
          if (id === templateId) setTemplateId(undefined);
        }}
      />
    </div>
  );
}
