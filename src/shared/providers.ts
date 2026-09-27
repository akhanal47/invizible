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
  },
  { id: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', models: [] },
  { id: 'llamacpp', name: 'llama.cpp (local)', baseUrl: 'http://localhost:8080/v1', models: [] }
] as const;

export function isLocalEndpoint(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export type ProviderId = (typeof PROVIDERS)[number]['id'] | 'custom';

export function providerForUrl(baseUrl: string): ProviderId {
  return (
    PROVIDERS.find((provider) => provider.baseUrl === baseUrl.trim().replace(/\/+$/, ''))?.id ??
    'custom'
  );
}

export function supportsTranscription(baseUrl: string): boolean {
  const provider = providerForUrl(baseUrl);
  return !isLocalEndpoint(baseUrl) && (provider === 'openai' || provider === 'custom');
}
