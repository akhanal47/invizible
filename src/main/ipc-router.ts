import { app, ipcMain, shell } from 'electron';
import { IPC } from '../shared/ipc-contract';
import type {
  ChatSendRequest,
  OverlayMoveRequest,
  TranscriptionRequest
} from '../shared/ipc-contract';
import type { ChatError } from '../shared/chat-types';
import type { SettingsUpdate } from '../shared/settings';
import { grabSource, listSources } from './capture';
import { LlmClientError, streamChat, testConnection, listModels } from './llm-client';
import { recognize } from './ocr';
import { SttClientError, transcribe } from './stt-client';
import { closeOverlay, nudge } from './window';
import type { SettingsStore } from './settings-store';

import { isLocalEndpoint } from '../shared/providers';
import { LiveTranscription } from './live-stt';

export function registerIpcHandlers(settingsStore: SettingsStore): void {
  const requests = new Map<string, AbortController>();
  const apiKey = (): string => {
    const key = settingsStore.getApiKey();
    if (!key && !isLocalEndpoint(settingsStore.getView().baseUrl))
      throw new Error('Add an API key in Settings before making a request.');
    return key ?? '';
  };
  const live = new Map<number, LiveTranscription>();
  app.on('before-quit', () => {
    for (const session of live.values()) session.cancel();
  });
  ipcMain.handle(IPC.chatModels, (_event, baseUrl: string, key?: string) => {
    const saved = settingsStore.getView();
    const sameEndpoint = baseUrl.replace(/\/+$/, '') === saved.baseUrl.replace(/\/+$/, '');
    return listModels(baseUrl, key || (sameEndpoint ? (settingsStore.getApiKey() ?? '') : ''));
  });
  ipcMain.handle(IPC.sttStart, async (event, sessionId: string) => {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 100)
      throw new Error('Invalid transcription session.');
    const owner = event.sender;
    if (live.has(owner.id)) throw new Error('Transcription is already running.');
    const settings = settingsStore.getView();
    const key = settingsStore.getSttApiKey();
    if (settings.sttProvider !== 'deepgram' || !key)
      throw new Error('Choose Deepgram and add its API key in Voice input.');
    const cleanup = (): void => {
      session.cancel();
    };
    const session = new LiveTranscription((result) => {
      if (result.type === 'done' || result.type === 'error') {
        live.delete(owner.id);
        owner.removeListener('destroyed', cleanup);
        owner.removeListener('did-start-loading', cleanup);
        owner.removeListener('render-process-gone', cleanup);
      }
      if (!owner.isDestroyed()) owner.send(IPC.sttStream, result);
    }, sessionId);
    live.set(owner.id, session);
    owner.once('destroyed', cleanup);
    owner.once('did-start-loading', cleanup);
    owner.once('render-process-gone', cleanup);
    try {
      await session.start(key, settings.liveSttModel, settings.liveSttLanguage);
    } catch (error) {
      session.cancel();
      throw error;
    }
  });
  ipcMain.handle(IPC.sttAudio, (event, sessionId: string, audio: ArrayBuffer) => {
    const session = live.get(event.sender.id);
    if (!session || session.sessionId !== sessionId)
      throw new Error('Transcription session has ended.');
    return session.send(audio);
  });
  ipcMain.handle(IPC.sttStop, (event, sessionId: string) => {
    const session = live.get(event.sender.id);
    if (session?.sessionId === sessionId) session.stop();
  });
  ipcMain.handle(IPC.sttCancel, (event, sessionId: string) => {
    const session = live.get(event.sender.id);
    if (session?.sessionId === sessionId) session.cancel();
  });
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
    if (settingsStore.getView().sttProvider !== 'compatible')
      throw new Error('Use live dictation for Deepgram.');
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
