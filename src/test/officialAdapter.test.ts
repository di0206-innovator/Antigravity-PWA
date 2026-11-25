import { describe, expect, it, vi } from 'vitest';
import {
  OfficialAdapterError,
  UNSUPPORTED_OFFICIAL_API_CODE,
  officialIntegrationAdapter,
} from '../services/officialAdapter';

describe('officialIntegrationAdapter', () => {
  it('remains permanently disabled with documented permitted actions only', () => {
    expect(officialIntegrationAdapter.enabled).toBe(false);
    const capabilities = officialIntegrationAdapter.getCapabilities();
    expect(capabilities.enabled).toBe(false);
    expect(capabilities.reason).toMatch(/public Antigravity API/i);
    expect(capabilities.permittedActions).toEqual([
      'open_official_url',
      'copy_prompt_locally',
    ]);

    expect(Object.isFrozen(officialIntegrationAdapter)).toBe(true);
    expect(Object.isFrozen(capabilities)).toBe(true);
    expect(Object.isFrozen(capabilities.permittedActions)).toBe(true);

    expect(() => {
      (officialIntegrationAdapter as unknown as { enabled: boolean }).enabled = true;
    }).toThrow(TypeError);
    expect(() => {
      (capabilities as unknown as { enabled: boolean }).enabled = true;
    }).toThrow(TypeError);
    expect(() => {
      (capabilities.permittedActions as string[]).push('unauthorized_action');
    }).toThrow(TypeError);
    expect(officialIntegrationAdapter.enabled).toBe(false);
    expect(officialIntegrationAdapter.getCapabilities().enabled).toBe(false);
  });

  it('rejects all async methods with UNSUPPORTED_OFFICIAL_API and makes zero network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(officialIntegrationAdapter.connect()).rejects.toMatchObject({
      name: 'OfficialAdapterError',
      code: UNSUPPORTED_OFFICIAL_API_CODE,
    });
    await expect(officialIntegrationAdapter.getLiveStatus()).rejects.toBeInstanceOf(
      OfficialAdapterError
    );
    await expect(officialIntegrationAdapter.submitPrompt()).rejects.toMatchObject({
      code: UNSUPPORTED_OFFICIAL_API_CODE,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
