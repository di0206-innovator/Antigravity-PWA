import type {
  OfficialIntegrationAdapter,
  OfficialIntegrationCapabilities,
} from '../types/domain';

export const UNSUPPORTED_OFFICIAL_API_CODE = 'UNSUPPORTED_OFFICIAL_API' as const;

export const DISABLED_OFFICIAL_API_REASON =
  'Disabled until a documented permitted public Antigravity API becomes available.';

export class OfficialAdapterError extends Error {
  readonly code = UNSUPPORTED_OFFICIAL_API_CODE;

  constructor(message: string = DISABLED_OFFICIAL_API_REASON) {
    super(message);
    this.name = 'OfficialAdapterError';
  }
}

const PERMITTED_ACTIONS: readonly string[] = Object.freeze([
  'open_official_url',
  'copy_prompt_locally',
]);

export const officialIntegrationAdapter: OfficialIntegrationAdapter = Object.freeze({
  id: 'official-antigravity-placeholder',
  enabled: false as const,
  statusReason: DISABLED_OFFICIAL_API_REASON,

  getCapabilities(): OfficialIntegrationCapabilities {
    return Object.freeze({
      enabled: false as const,
      reason: DISABLED_OFFICIAL_API_REASON,
      permittedActions: PERMITTED_ACTIONS,
    });
  },

  connect(): Promise<never> {
    return Promise.reject(new OfficialAdapterError());
  },

  getLiveStatus(): Promise<never> {
    return Promise.reject(new OfficialAdapterError());
  },

  submitPrompt(): Promise<never> {
    return Promise.reject(new OfficialAdapterError());
  },
});
