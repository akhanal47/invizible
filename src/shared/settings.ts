export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface Settings {
  baseUrl: string;
  sttBaseUrl: string | null;
  model: string;
  sttModel: string;
  sttProvider: 'compatible' | 'deepgram';
  liveSttModel: string;
  liveSttLanguage: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  contextBudgetTokens: number;
  systemPrompt: string;
  baseUserPrompt: string;
  debugLogging: boolean;
}

export interface SettingsView extends Settings {
  hasApiKey: boolean;
  hasSttApiKey: boolean;
}

export interface SettingsUpdate extends Partial<Settings> {
  /** Write-only: omitted leaves it unchanged, an empty string clears it. */
  apiKey?: string;
  sttApiKey?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.openai.com/v1',
  sttBaseUrl: null,
  model: 'gpt-6-luna',
  sttModel: 'whisper-1',
  sttProvider: 'compatible',
  liveSttModel: 'nova-3',
  liveSttLanguage: 'en',
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
  if (update.sttProvider !== undefined && !['compatible', 'deepgram'].includes(update.sttProvider))
    errors.push('Voice provider is invalid.');
  for (const key of ['liveSttModel', 'liveSttLanguage'] as const) {
    if (update[key] !== undefined && (typeof update[key] !== 'string' || !update[key].trim()))
      errors.push('Live transcription model and language are required.');
  }

  if (update.baseUrl !== undefined) {
    try {
      const url = new URL(update.baseUrl);
      if (!['http:', 'https:'].includes(url.protocol))
        errors.push('Base URL must use HTTP or HTTPS.');
    } catch {
      errors.push('Base URL must be a valid URL.');
    }
  }
  if (update.sttBaseUrl !== undefined && update.sttBaseUrl !== null) {
    try {
      const url = new URL(update.sttBaseUrl);
      if (!['http:', 'https:'].includes(url.protocol))
        errors.push('STT base URL must use HTTP or HTTPS.');
    } catch {
      errors.push('STT base URL must be a valid URL.');
    }
  }
  if (update.model !== undefined && update.model.trim() === '') errors.push('Model is required.');
  if (update.sttModel !== undefined && update.sttModel.trim() === '')
    errors.push('STT model is required.');
  if (update.reasoningEffort !== undefined && !reasoningEfforts.includes(update.reasoningEffort)) {
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
