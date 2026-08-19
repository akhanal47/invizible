export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type Attachment =
  | { type: 'screen_text'; text: string; imageWidth: number; imageHeight: number }
  | { type: 'transcript'; text: string };

export type ChatErrorKind = 'auth' | 'rate_limit' | 'bad_request' | 'network' | 'aborted' | 'unknown';

export interface ChatError {
  kind: ChatErrorKind;
  message: string;
  status?: number;
}

export type StreamEvent =
  | { requestId: string; type: 'delta'; text: string }
  | { requestId: string; type: 'done'; finishReason: string | null }
  | { requestId: string; type: 'error'; error: ChatError }
  | { requestId: string; type: 'notice'; text: string };
