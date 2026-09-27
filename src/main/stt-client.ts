import { supportsTranscription } from '../shared/providers';
import type { Settings } from '../shared/settings';

export class SttClientError extends Error {
  constructor(
    readonly detail: {
      kind: 'auth' | 'bad_request' | 'network' | 'unknown';
      message: string;
      status?: number;
    }
  ) {
    super(detail.message);
  }
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`;
}

export async function transcribe(
  settings: Settings,
  apiKey: string,
  audio: ArrayBuffer,
  mimeType: string
): Promise<string> {
  if (!supportsTranscription(settings.sttBaseUrl ?? settings.baseUrl)) {
    throw new SttClientError({
      kind: 'bad_request',
      message: 'Choose a transcription endpoint in Settings → Voice input.'
    });
  }
  const form = new FormData();
  form.set('file', new Blob([audio], { type: mimeType || 'audio/webm' }), 'recording.webm');
  form.set('model', settings.sttModel);
  let response: Response;
  try {
    response = await fetch(endpoint(settings.sttBaseUrl ?? settings.baseUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
  } catch (error) {
    throw new SttClientError({
      kind: 'network',
      message: error instanceof Error ? error.message : 'Transcription request failed.'
    });
  }
  if (!response.ok) {
    const message = await response.text();
    throw new SttClientError({
      kind: response.status === 401 ? 'auth' : 'bad_request',
      message: message || 'Transcription failed.',
      status: response.status
    });
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('text' in payload) ||
    typeof payload.text !== 'string'
  ) {
    throw new SttClientError({
      kind: 'unknown',
      message: 'Transcription provider returned an invalid response.'
    });
  }
  return payload.text.trim();
}
