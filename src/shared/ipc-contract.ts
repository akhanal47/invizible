import type { ChatMessage, StreamEvent } from './chat-types';
import type { SettingsUpdate, SettingsView } from './settings';

/** The only IPC channel definitions shared by the renderer and main process. */
export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  chatSend: 'chat:send',
  chatAbort: 'chat:abort',
  chatStream: 'chat:stream',
  overlayMove: 'overlay:move'
} as const;

export interface ChatSendRequest {
  requestId: string;
  messages: ChatMessage[];
}

export interface OverlayMoveRequest {
  direction: 'up' | 'down' | 'left' | 'right';
  pixels?: number;
}

export interface AssistantApi {
  settings: {
    get(): Promise<SettingsView>;
    set(update: SettingsUpdate): Promise<SettingsView>;
  };
  chat: {
    send(request: ChatSendRequest): Promise<void>;
    abort(requestId: string): Promise<void>;
    onStream(listener: (event: StreamEvent) => void): () => void;
  };
  overlay: {
    move(request: OverlayMoveRequest): Promise<void>;
  };
}
