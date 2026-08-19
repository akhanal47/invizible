import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AssistantApi,
  type ChatSendRequest,
  type OverlayMoveRequest,
  type TranscriptionRequest,
  type UiAction
} from '../shared/ipc-contract';
import type { StreamEvent } from '../shared/chat-types';
import type { SettingsUpdate } from '../shared/settings';

const api: AssistantApi = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (update: SettingsUpdate) => ipcRenderer.invoke(IPC.settingsSet, update)
  },
  chat: {
    send: (request: ChatSendRequest) => ipcRenderer.invoke(IPC.chatSend, request),
    abort: (requestId: string) => ipcRenderer.invoke(IPC.chatAbort, requestId),
    test: () => ipcRenderer.invoke(IPC.chatTest),
    onStream: (listener: (event: StreamEvent) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, event: StreamEvent): void => listener(event);
      ipcRenderer.on(IPC.chatStream, wrapped);
      return () => ipcRenderer.removeListener(IPC.chatStream, wrapped);
    }
  },
  overlay: {
    move: (request: OverlayMoveRequest) => ipcRenderer.invoke(IPC.overlayMove, request),
    close: () => ipcRenderer.invoke(IPC.overlayClose)
  },
  capture: {
    listSources: () => ipcRenderer.invoke(IPC.captureListSources),
    grabAndOcr: (sourceId: string) => ipcRenderer.invoke(IPC.captureGrabAndOcr, sourceId)
  },
  stt: {
    transcribe: (request: TranscriptionRequest) => ipcRenderer.invoke(IPC.sttTranscribe, request)
  },
  ui: {
    onAction: (listener: (action: UiAction) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, action: UiAction): void => listener(action);
      ipcRenderer.on(IPC.uiAction, wrapped);
      return () => ipcRenderer.removeListener(IPC.uiAction, wrapped);
    }
  }
};

contextBridge.exposeInMainWorld('assistantApi', api);
