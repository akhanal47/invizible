import { ipcMain, shell } from 'electron';
import { IPC } from '../shared/ipc-contract';
import type {
  ChatSendRequest,
  OverlayMoveRequest,
  TranscriptionRequest
} from '../shared/ipc-contract';
import type { ChatError } from '../shared/chat-types';
import type { SettingsUpdate } from '../shared/settings';
import { grabSource, listSources } from './capture';
import { LlmClientError, streamChat, testConnection } from './llm-client';
import { recognize } from './ocr';
import { SttClientError, transcribe } from './stt-client';
import { closeOverlay, nudge } from './window';
import type { SettingsStore } from './settings-store';

export function registerIpcHandlers(settingsStore: SettingsStore): void {
  const requests = new Map<string, AbortController>();
  const apiKey = (): string => {
    const key = settingsStore.getApiKey();
    if (!key) throw new Error('Add an API key in Settings before making a request.');
    return key;
  };
  ipcMain.handle(IPC.settingsGet, () => settingsStore.getView());
  ipcMain.handle(IPC.settingsSet, (_event, update: SettingsUpdate) => settingsStore.update(update));
  ipcMain.handle(IPC.overlayMove, (_event, request: OverlayMoveRequest) => {
    nudge(request.direction, request.pixels);
  });
  ipcMain.handle(IPC.overlayClose, closeOverlay);
  ipcMain.handle(IPC.systemOpenScreenRecordingSettings, () =>
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  );
  ipcMain.handle(IPC.captureListSources, listSources);
  ipcMain.handle(IPC.captureGrabAndOcr, async (_event, sourceId: string) => {
    const startedAt = Date.now();
    const capture = await grabSource(sourceId);
    return {
      text: await recognize(capture.png),
      imageWidth: capture.imageWidth,
      imageHeight: capture.imageHeight,
      durationMs: Date.now() - startedAt
    };
  });
  ipcMain.handle(IPC.sttTranscribe, async (_event, request: TranscriptionRequest) => {
    const key = settingsStore.getSttApiKey();
    if (!key) throw new Error('Add a transcription API key in Settings → Voice input.');
    return transcribe(settingsStore.getView(), key, request.audio, request.mimeType);
  });
  ipcMain.handle(IPC.chatTest, async () => testConnection(settingsStore.getView(), apiKey()));
  ipcMain.handle(IPC.chatAbort, (_event, requestId: string) => requests.get(requestId)?.abort());
  ipcMain.handle(IPC.chatSend, async (event, request: ChatSendRequest) => {
    if (requests.has(request.requestId)) throw new Error('That chat request is already running.');
    const controller = new AbortController();
    requests.set(request.requestId, controller);
    try {
      for await (const streamEvent of streamChat(
        settingsStore.getView(),
        apiKey(),
        request.messages,
        controller.signal
      )) {
        event.sender.send(IPC.chatStream, { requestId: request.requestId, ...streamEvent });
      }
    } catch (error) {
      const detail: ChatError =
        error instanceof LlmClientError
          ? error.detail
          : error instanceof SttClientError
            ? error.detail
            : {
                kind: 'unknown',
                message: error instanceof Error ? error.message : 'Chat request failed.'
              };
      event.sender.send(IPC.chatStream, {
        requestId: request.requestId,
        type: 'error',
        error: detail
      });
    } finally {
      requests.delete(request.requestId);
    }
  });
}
