export const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-6-luna', 'gpt-6-sol', 'gpt-6-astra', 'gpt-5.4-mini', 'gpt-4.1-mini']
  },
  {
    id: 'claude',
    name: 'Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5-20251001']
  },
  {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview']
  }
] as const;

export type ProviderId = (typeof PROVIDERS)[number]['id'] | 'custom';

export function providerForUrl(baseUrl: string): ProviderId {
  return (
    PROVIDERS.find((provider) => provider.baseUrl === baseUrl.trim().replace(/\/+$/, ''))?.id ??
    'custom'
  );
}

export function supportsTranscription(baseUrl: string): boolean {
  const provider = providerForUrl(baseUrl);
  return provider === 'openai' || provider === 'custom';
}
