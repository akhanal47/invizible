import { isLocalEndpoint } from '../shared/providers';
import type { ChatError, ChatMessage } from '../shared/chat-types';
import type { Settings } from '../shared/settings';

export type LlmEvent =
  | { type: 'delta'; text: string }
  | { type: 'notice'; text: string }
  | { type: 'done'; finishReason: string | null };

export class LlmClientError extends Error {
  constructor(readonly detail: ChatError) {
    super(detail.message);
  }
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function toError(response: Response, message: string): LlmClientError {
  const kind: ChatError['kind'] =
    response.status === 401 || response.status === 403
      ? 'auth'
      : response.status === 429
        ? 'rate_limit'
        : response.status >= 400 && response.status < 500
          ? 'bad_request'
          : 'unknown';
  return new LlmClientError({
    kind,
    message: message || `Request failed (${response.status}).`,
    status: response.status
  });
}

async function createResponse(
  settings: Settings,
  apiKey: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  includeReasoningEffort: boolean
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    stream: true,
    // Newer OpenAI reasoning models reject the legacy max_tokens field.
    [/^(gpt-[5-9](?:[.-]|$)|o[1-9](?:-|$))/.test(settings.model)
      ? 'max_completion_tokens'
      : 'max_tokens']: settings.maxOutputTokens
  };
  if (includeReasoningEffort && settings.reasoningEffort !== 'none')
    body.reasoning_effort = settings.reasoningEffort;
  try {
    return await fetch(endpoint(settings.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (error) {
    if (signal.aborted)
      throw new LlmClientError({ kind: 'aborted', message: 'Generation stopped.' });
    throw new LlmClientError({
      kind: 'network',
      message: isLocalEndpoint(settings.baseUrl)
        ? 'Cannot reach the local model server. Start Ollama or llama-server and check the endpoint in Settings.'
        : error instanceof Error
          ? error.message
          : 'Network request failed.'
    });
  }
}

export async function* streamChat(
  settings: Settings,
  apiKey: string,
  messages: ChatMessage[],
  signal: AbortSignal
): AsyncGenerator<LlmEvent> {
  let response = await createResponse(settings, apiKey, messages, signal, true);
  if (!response.ok) {
    const responseText = await response.text();
    if (
      response.status === 400 &&
      settings.reasoningEffort !== 'none' &&
      /reasoning_effort/i.test(responseText)
    ) {
      response = await createResponse(settings, apiKey, messages, signal, false);
      if (response.ok)
        yield {
          type: 'notice',
          text: 'This provider does not support reasoning effort; retried without it.'
        };
    } else {
      throw toError(response, responseText);
    }
  }
  if (!response.ok) throw toError(response, await response.text());
  if (!response.body)
    throw new LlmClientError({
      kind: 'network',
      message: 'The server returned no response stream.'
    });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remainder = '';
  let finishReason: string | null = null;
  while (true) {
    const { done, value } = await reader.read();
    remainder += decoder.decode(value, { stream: !done });
    const lines = remainder.split(/\r?\n/);
    remainder = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
        };
        const choice = parsed.choices?.[0];
        if (choice?.delta?.content) yield { type: 'delta', text: choice.delta.content };
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch {
        // Non-JSON SSE keep-alives are ignored; protocol errors surface as an empty completion.
      }
    }
    if (done) break;
  }
  yield { type: 'done', finishReason };
}

export async function testConnection(settings: Settings, apiKey: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await createResponse(
      settings,
      apiKey,
      [{ role: 'user', content: 'Reply with OK.' }],
      controller.signal,
      false
    );
    if (!response.ok) throw toError(response, await response.text());
    await response.body?.cancel();
  } finally {
    clearTimeout(timer);
  }
}

export async function listModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Use an HTTP or HTTPS endpoint.');
  const response = await fetch(endpoint(baseUrl, '/models'), {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw toError(response, await response.text());
  const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
  if (!Array.isArray(body.data)) throw new Error('This server did not return a model list.');
  return [
    ...new Set(
      body.data
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && !!id.trim())
    )
  ];
}
