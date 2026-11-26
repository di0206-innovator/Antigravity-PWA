import { logActivity } from '../../db/activityService';
import { useAppStore } from '../../stores/useAppStore';
import type { ActivityCategory } from '../../types/domain';

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to textarea fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    document.body.removeChild(ta);
    return Boolean(ok);
  } catch {
    return false;
  }
}

/** Copies text, toasts the result, and logs an activity entry on success. */
export async function copyWithFeedback(
  text: string,
  label: string,
  category: ActivityCategory = 'prompt'
): Promise<boolean> {
  const { addToast } = useAppStore.getState();
  const ok = await writeClipboard(text);
  if (ok) {
    addToast(`Copied ${label} to clipboard.`, 'success');
    try {
      await logActivity({ category, description: `Copied ${label} to clipboard` });
    } catch {
      /* logging is best effort */
    }
  } else {
    addToast('Could not copy. Select the text and copy it manually.', 'error');
  }
  return ok;
}

export function parseTags(raw: string): string[] {
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

export function errorIssues(e: unknown): string[] {
  const issues = (e as { issues?: unknown })?.issues;
  if (Array.isArray(issues)) return issues.map(String);
  return [e instanceof Error ? e.message : 'Something went wrong.'];
}
