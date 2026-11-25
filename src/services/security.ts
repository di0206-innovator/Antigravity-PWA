export const OFFICIAL_ANTIGRAVITY_BASE_URL = 'https://antigravity.google.com';

export const OFFICIAL_DOCS_URLS = {
  remoteControl: 'https://antigravity.google/docs/remote-control',
  remoteAgents: 'https://antigravity.google/docs/remote-agents',
  faq: 'https://antigravity.google/docs/faq',
} as const;

// Strips ASCII NUL and control characters while preserving \n (\u000A), \r (\u000D), and \t (\u0009).
// eslint-disable-next-line no-control-regex
const UNSAFE_CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WHITESPACE_REGEX = /\s/;
const TEMPLATE_VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface OfficialUrlValidationOptions {
  allowEmpty?: boolean;
  allowDocs?: boolean;
}

export interface OfficialUrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

export interface OpenOfficialUrlResult {
  opened: boolean;
  normalizedUrl?: string;
  error?: string;
}

/**
 * Validates that a URL points exclusively to official Google Antigravity destinations.
 */
export function validateOfficialAntigravityUrl(
  url: string,
  options?: OfficialUrlValidationOptions
): OfficialUrlValidationResult {
  if (typeof url !== 'string') {
    return { valid: false, error: 'Official Antigravity URL must be a string.' };
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    if (options?.allowEmpty) {
      return { valid: true, normalizedUrl: '' };
    }
    return { valid: false, error: 'Official Antigravity URL is required.' };
  }

  if (UNSAFE_CONTROL_CHAR_REGEX.test(trimmed) || WHITESPACE_REGEX.test(trimmed)) {
    UNSAFE_CONTROL_CHAR_REGEX.lastIndex = 0;
    return { valid: false, error: 'Official Antigravity URL contains invalid whitespace or control characters.' };
  }
  UNSAFE_CONTROL_CHAR_REGEX.lastIndex = 0;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS official Antigravity URLs are permitted.' };
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return { valid: false, error: 'URLs with embedded credentials are not allowed.' };
  }

  if (parsed.port !== '') {
    return { valid: false, error: 'Custom ports are not allowed on official Antigravity URLs.' };
  }

  const isAppHost = parsed.hostname === 'antigravity.google.com';
  const isDocsUrl =
    Boolean(options?.allowDocs) &&
    parsed.hostname === 'antigravity.google' &&
    (parsed.pathname === '/docs' || parsed.pathname.startsWith('/docs/'));

  if (!isAppHost && !isDocsUrl) {
    return {
      valid: false,
      error: options?.allowDocs
        ? 'URL must point to https://antigravity.google.com or https://antigravity.google/docs/*.'
        : 'URL must point to https://antigravity.google.com.',
    };
  }

  if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
    return { valid: true, normalizedUrl: `https://${parsed.hostname}` };
  }

  const normalizedPath =
    parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, '') : parsed.pathname;
  const pathPart = normalizedPath === '/' && !parsed.search && !parsed.hash ? '' : normalizedPath;
  const normalizedUrl = `${parsed.origin}${pathPart}${parsed.search}${parsed.hash}`;

  return { valid: true, normalizedUrl };
}

/**
 * Opens a validated official Antigravity URL in a new tab with noopener,noreferrer.
 * Note: Per HTML spec, window.open(..., 'noopener,noreferrer') intentionally returns null on success.
 */
export function openOfficialUrl(
  url: string,
  options?: { allowDocs?: boolean }
): OpenOfficialUrlResult {
  const validation = validateOfficialAntigravityUrl(url, {
    allowEmpty: false,
    allowDocs: options?.allowDocs ?? true,
  });

  if (!validation.valid || !validation.normalizedUrl) {
    return { opened: false, error: validation.error ?? 'Invalid official Antigravity URL.' };
  }

  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { opened: false, error: 'Browser window is unavailable.' };
  }

  try {
    window.open(validation.normalizedUrl, '_blank', 'noopener,noreferrer');
    return { opened: true, normalizedUrl: validation.normalizedUrl };
  } catch {
    return { opened: false, error: 'Unable to open the official Antigravity window.' };
  }
}

/**
 * Sanitizes user-controlled text for safe plain-text storage and JSX rendering.
 * Preserves newlines and tabs while stripping NUL and unsafe ASCII control characters.
 */
export function sanitizePlainText(value: string, maxLength = 50000): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalizedNewlines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cleaned = normalizedNewlines.replace(UNSAFE_CONTROL_CHAR_REGEX, '');
  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength);
  }
  return cleaned;
}

/**
 * Extracts unique {{variable}} names from a prompt template in order of appearance.
 */
export function extractTemplateVariables(templateBody: string): string[] {
  if (typeof templateBody !== 'string' || templateBody.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  TEMPLATE_VARIABLE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TEMPLATE_VARIABLE_REGEX.exec(templateBody)) !== null) {
    const varName = match[1];
    if (!seen.has(varName)) {
      seen.add(varName);
      ordered.push(varName);
    }
  }

  return ordered;
}

const BLOCKED_TEMPLATE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Replaces {{variable}} tokens with sanitized user values while preserving unfilled tokens.
 */
export function interpolatePromptVariables(
  templateBody: string,
  values: Record<string, string>
): string {
  if (typeof templateBody !== 'string') {
    return '';
  }

  const cleanBody = sanitizePlainText(templateBody);
  const safeValues = values && typeof values === 'object' ? values : {};

  return cleanBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (fullMatch, varName: string) => {
    if (BLOCKED_TEMPLATE_KEYS.has(varName) || !Object.hasOwn(safeValues, varName)) {
      return fullMatch;
    }
    const rawValue = safeValues[varName];
    if (typeof rawValue !== 'string') {
      return fullMatch;
    }
    const cleanValue = sanitizePlainText(rawValue);
    if (cleanValue.trim().length === 0) {
      return fullMatch;
    }
    return cleanValue;
  });
}
