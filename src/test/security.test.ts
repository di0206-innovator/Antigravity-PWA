import { describe, expect, it, vi } from 'vitest';
import {
  OFFICIAL_ANTIGRAVITY_BASE_URL,
  OFFICIAL_DOCS_URLS,
  extractTemplateVariables,
  interpolatePromptVariables,
  openOfficialUrl,
  sanitizePlainText,
  validateOfficialAntigravityUrl,
} from '../services/security';

describe('security boundary utilities', () => {
  describe('validateOfficialAntigravityUrl', () => {
    it('accepts official Antigravity app URLs and normalizes root/trailing slashes', () => {
      expect(validateOfficialAntigravityUrl('https://antigravity.google.com')).toEqual({
        valid: true,
        normalizedUrl: OFFICIAL_ANTIGRAVITY_BASE_URL,
      });

      expect(validateOfficialAntigravityUrl('HTTPS://ANTIGRAVITY.GOOGLE.COM/')).toEqual({
        valid: true,
        normalizedUrl: 'https://antigravity.google.com',
      });

      expect(
        validateOfficialAntigravityUrl('https://antigravity.google.com/r/abc123?p=c%2Fconv456#top')
      ).toEqual({
        valid: true,
        normalizedUrl: 'https://antigravity.google.com/r/abc123?p=c%2Fconv456#top',
      });
    });

    it('accepts official docs URLs only when allowDocs is enabled', () => {
      expect(validateOfficialAntigravityUrl(OFFICIAL_DOCS_URLS.remoteControl)).toEqual(
        expect.objectContaining({ valid: false })
      );

      expect(
        validateOfficialAntigravityUrl(OFFICIAL_DOCS_URLS.remoteControl, { allowDocs: true })
      ).toEqual({
        valid: true,
        normalizedUrl: OFFICIAL_DOCS_URLS.remoteControl,
      });

      expect(
        validateOfficialAntigravityUrl('https://antigravity.google/docs/faq/', { allowDocs: true })
      ).toEqual({
        valid: true,
        normalizedUrl: 'https://antigravity.google/docs/faq',
      });
    });

    it('permits empty strings only when allowEmpty is true', () => {
      expect(validateOfficialAntigravityUrl('   ')).toEqual(
        expect.objectContaining({ valid: false })
      );
      expect(validateOfficialAntigravityUrl('   ', { allowEmpty: true })).toEqual({
        valid: true,
        normalizedUrl: '',
      });
    });

    it('rejects unsafe protocols, non-official hosts, embedded credentials, ports, and malformed URLs', () => {
      const invalidCases = [
        'http://antigravity.google.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'https://user:pass@antigravity.google.com',
        'https://antigravity.google.com:8443/r/1',
        'https://antigravity.google.com.evil.com',
        'https://evil-antigravity.google.com',
        'https://accounts.google.com',
        'https://antigravity.google/other-path',
        'https://antigravity.google.com/has space',
        'not a url',
      ];

      for (const candidate of invalidCases) {
        const res = validateOfficialAntigravityUrl(candidate, { allowDocs: true });
        expect(res.valid, `Expected ${candidate} to be rejected`).toBe(false);
      }
    });
  });

  describe('openOfficialUrl', () => {
    it('opens valid URLs with noopener,noreferrer even when window.open returns null', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const res = openOfficialUrl('https://antigravity.google.com/r/session-1');
      expect(res).toEqual({
        opened: true,
        normalizedUrl: 'https://antigravity.google.com/r/session-1',
      });
      expect(openSpy).toHaveBeenCalledWith(
        'https://antigravity.google.com/r/session-1',
        '_blank',
        'noopener,noreferrer'
      );

      openSpy.mockRestore();
    });

    it('blocks invalid URLs without calling window.open', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const res = openOfficialUrl('javascript:alert(1)');
      expect(res.opened).toBe(false);
      expect(res.error).toBeTruthy();
      expect(openSpy).not.toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });

  describe('sanitizePlainText', () => {
    it('strips NUL and control characters while preserving newlines, tabs, and plain literal text', () => {
      const input = 'Line 1\u0000\r\nLine\t2\u0007\u001F\n<script>alert(1)</script>';
      expect(sanitizePlainText(input)).toBe('Line 1\nLine\t2\n<script>alert(1)</script>');
    });

    it('caps output to maxLength', () => {
      expect(sanitizePlainText('abcdefghij', 5)).toBe('abcde');
    });
  });

  describe('template variable extraction and interpolation', () => {
    it('extracts unique variable names in order of appearance', () => {
      const body =
        'Build {{project_name}} for {{ task_description }} using {{project_name}} and {{constraints}}.';
      expect(extractTemplateVariables(body)).toEqual([
        'project_name',
        'task_description',
        'constraints',
      ]);
    });

    it('returns empty array when no variables exist', () => {
      expect(extractTemplateVariables('Plain prompt text')).toEqual([]);
    });

    it('interpolates filled variables and preserves unfilled placeholders', () => {
      const body = 'Project: {{project_name}}\nTask: {{task_description}}\nLimits: {{constraints}}';
      const result = interpolatePromptVariables(body, {
        project_name: 'AG Pocket\u0000',
        task_description: '   ',
      });
      expect(result).toBe('Project: AG Pocket\nTask: {{task_description}}\nLimits: {{constraints}}');
    });

    it('sanitizes control chars from templateBody and blocks prototype-chain / __proto__ keys', () => {
      const dirtyBody =
        'Hello\u0000\u0007 {{project_name}} {{__proto__}} {{constructor}} {{prototype}} {{toString}} {{empty_ctrl}}';
      const parsedValues = JSON.parse(
        '{"__proto__":"POLLUTED","constructor":"CTOR","prototype":"PROTO","project_name":"AG"}'
      ) as Record<string, string>;
      parsedValues.empty_ctrl = '\u0000\u0001';

      const output = interpolatePromptVariables(dirtyBody, parsedValues);
      expect(output).toBe(
        'Hello AG {{__proto__}} {{constructor}} {{prototype}} {{toString}} {{empty_ctrl}}'
      );
      expect(output).not.toContain('\u0000');
      expect(output).not.toContain('\u0007');
      expect(output).not.toContain('POLLUTED');
    });
  });
});
