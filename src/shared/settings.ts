export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface Settings {
  baseUrl: string;
  sttBaseUrl: string | null;
  model: string;
  sttModel: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  contextBudgetTokens: number;
  systemPrompt: string;
  baseUserPrompt: string;
  debugLogging: boolean;
}

export interface SettingsView extends Settings {
  hasApiKey: boolean;
}

export interface SettingsUpdate extends Partial<Settings> {
  /** Write-only: omitted leaves it unchanged, an empty string clears it. */
  apiKey?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.openai.com/v1',
  sttBaseUrl: null,
  model: 'gpt-4o-mini',
  sttModel: 'whisper-1',
  reasoningEffort: 'none',
  maxOutputTokens: 1_000,
  contextBudgetTokens: 12_000,
  systemPrompt: 'You are a helpful, concise interview assistant.',
  baseUserPrompt: '',
  debugLogging: false
};

const reasoningEfforts: readonly ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function validateSettingsUpdate(update: SettingsUpdate): string[] {
  const errors: string[] = [];
  if (update.baseUrl !== undefined) {
    try {
      const url = new URL(update.baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) errors.push('Base URL must use HTTP or HTTPS.');
    } catch {
      errors.push('Base URL must be a valid URL.');
    }
  }
  if (update.sttBaseUrl !== undefined && update.sttBaseUrl !== null) {
    try {
      new URL(update.sttBaseUrl);
    } catch {
      errors.push('STT base URL must be a valid URL.');
    }
  }
  if (update.model !== undefined && update.model.trim() === '') errors.push('Model is required.');
  if (update.sttModel !== undefined && update.sttModel.trim() === '') errors.push('STT model is required.');
  if (
    update.reasoningEffort !== undefined &&
    !reasoningEfforts.includes(update.reasoningEffort)
  ) {
    errors.push('Reasoning effort is invalid.');
  }
  if (update.maxOutputTokens !== undefined && !isPositiveInteger(update.maxOutputTokens)) {
    errors.push('Maximum output tokens must be a positive integer.');
  }
  if (update.contextBudgetTokens !== undefined && !isPositiveInteger(update.contextBudgetTokens)) {
    errors.push('Context budget must be a positive integer.');
  }
  return errors;
}
