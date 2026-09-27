import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { PROVIDERS } from '../shared/providers';
import { streamChat, listModels } from './llm-client';

const stream = () =>
  new Response(
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
  );
afterEach(() => vi.unstubAllGlobals());

async function collect(
  model = DEFAULT_SETTINGS.model,
  baseUrl = DEFAULT_SETTINGS.baseUrl,
  reasoningEffort: 'none' | 'high' = 'none'
) {
  const events = [];
  for await (const event of streamChat(
    { ...DEFAULT_SETTINGS, model, baseUrl, reasoningEffort },
    'test-key',
    [{ role: 'user', content: 'Hi' }],
    new AbortController().signal
  ))
    events.push(event);
  return events;
}

describe('OpenAI-compatible chat providers', () => {
  it.each(PROVIDERS)(
    'streams from $name with the expected endpoint and token parameter',
    async (provider) => {
      const fetchMock = vi.fn().mockResolvedValue(stream());
      vi.stubGlobal('fetch', fetchMock);
      expect(
        await collect(provider.models[0] ?? 'installed-model', `${provider.baseUrl}/`)
      ).toEqual([
        { type: 'delta', text: 'Hello' },
        { type: 'done', finishReason: 'stop' }
      ]);
      const [url, options] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${provider.baseUrl}/chat/completions`);
      const body = JSON.parse(options.body);
      expect(body.model).toBe(provider.models[0] ?? 'installed-model');
      expect(body[provider.id === 'openai' ? 'max_completion_tokens' : 'max_tokens']).toBe(
        DEFAULT_SETTINGS.maxOutputTokens
      );
      expect(body.reasoning_effort).toBeUndefined();
    }
  );

  it('preserves the provider error message without reading its body twice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Invalid API key', { status: 401 }))
    );
    await expect(collect()).rejects.toMatchObject({
      detail: { kind: 'auth', message: 'Invalid API key', status: 401 }
    });
  });

  it('retries an unsupported reasoning option once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Unsupported reasoning_effort', { status: 400 }))
      .mockResolvedValueOnce(stream());
    vi.stubGlobal('fetch', fetchMock);
    const events = await collect('custom-model', 'https://example.com/v1', 'high');
    expect(events[0]?.type).toBe('notice');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).reasoning_effort).toBe('high');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).reasoning_effort).toBeUndefined();
  });
});

it('omits authentication for a keyless local model and streams its answer', async () => {
  const fetchMock = vi.fn().mockResolvedValue(stream());
  vi.stubGlobal('fetch', fetchMock);
  const events = [];
  for await (const event of streamChat(
    { ...DEFAULT_SETTINGS, baseUrl: 'http://localhost:11434/v1', model: 'local' },
    '',
    [],
    new AbortController().signal
  ))
    events.push(event);
  expect(events[0]).toEqual({ type: 'delta', text: 'Hello' });
  expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty('Authorization');
});

it('discovers model IDs without sending an empty authorization header', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      Response.json({ data: [{ id: 'small' }, { id: 'small' }, { id: 42 }, { id: 'large' }] })
    );
  vi.stubGlobal('fetch', fetchMock);
  expect(await listModels('http://localhost:8080/v1/', '')).toEqual(['small', 'large']);
  expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:8080/v1/models');
  expect(fetchMock.mock.calls[0]![1].headers).toEqual({});
});

it('shows an actionable local server connection error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
  await expect(collect('local', 'http://localhost:11434/v1')).rejects.toMatchObject({
    detail: { kind: 'network', message: expect.stringContaining('Start Ollama or llama-server') }
  });
});
