import type { ChatMessage, StreamEvent } from './chat-types';
import type { SettingsUpdate, SettingsView } from './settings';

/** The only IPC channel definitions shared by the renderer and main process. */
export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  chatSend: 'chat:send',
  chatAbort: 'chat:abort',
  chatStream: 'chat:stream',
  chatTest: 'chat:test',
  chatModels: 'chat:models',
  sttStart: 'stt:start',
  sttAudio: 'stt:audio',
  sttStop: 'stt:stop',
  sttCancel: 'stt:cancel',
  sttStream: 'stt:stream',
  captureListSources: 'capture:list-sources',
  captureGrabAndOcr: 'capture:grab-and-ocr',
  sttTranscribe: 'stt:transcribe',
  systemOpenScreenRecordingSettings: 'system:open-screen-recording-settings',
  uiAction: 'ui:action',
  overlayMove: 'overlay:move',
  overlayClose: 'overlay:close'
} as const;

export interface ChatSendRequest {
  requestId: string;
  messages: ChatMessage[];
}

export interface OverlayMoveRequest {
  direction: 'up' | 'down' | 'left' | 'right';
  pixels?: number;
}

export interface CaptureSource {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  thumbnailDataUrl: string;
}

export interface OcrResult {
  text: string;
  imageWidth: number;
  imageHeight: number;
  durationMs: number;
}

export interface TranscriptionRequest {
  audio: ArrayBuffer;
  mimeType: string;
}

export type LiveTranscriptionEvent = { sessionId: string } & (
  | { type: 'transcript'; text: string; final: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string }
);

export type UiAction = 'capture' | 'toggle-mic';

export interface AssistantApi {
  settings: {
    get(): Promise<SettingsView>;
    set(update: SettingsUpdate): Promise<SettingsView>;
  };
  chat: {
    send(request: ChatSendRequest): Promise<void>;
    abort(requestId: string): Promise<void>;
    test(): Promise<void>;
    models(baseUrl: string, apiKey?: string): Promise<string[]>;
    onStream(listener: (event: StreamEvent) => void): () => void;
  };
  overlay: {
    move(request: OverlayMoveRequest): Promise<void>;
    close(): Promise<void>;
  };
  capture: {
    listSources(): Promise<CaptureSource[]>;
    grabAndOcr(sourceId: string): Promise<OcrResult>;
  };
  stt: {
    transcribe(request: TranscriptionRequest): Promise<string>;
    start(sessionId: string): Promise<void>;
    audio(sessionId: string, audio: ArrayBuffer): Promise<void>;
    stop(sessionId: string): Promise<void>;
    cancel(sessionId: string): Promise<void>;
    onStream(listener: (event: LiveTranscriptionEvent) => void): () => void;
  };
  system: {
    openScreenRecordingSettings(): Promise<void>;
  };
  ui: {
    onAction(listener: (action: UiAction) => void): () => void;
  };
}
