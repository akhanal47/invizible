import { ipcMain } from 'electron';
import { IPC } from '../shared/ipc-contract';
import type { OverlayMoveRequest } from '../shared/ipc-contract';
import type { SettingsUpdate } from '../shared/settings';
import { nudge } from './window';
import type { SettingsStore } from './settings-store';

export function registerIpcHandlers(settingsStore: SettingsStore): void {
  ipcMain.handle(IPC.settingsGet, () => settingsStore.getView());
  ipcMain.handle(IPC.settingsSet, (_event, update: SettingsUpdate) => settingsStore.update(update));
  ipcMain.handle(IPC.overlayMove, (_event, request: OverlayMoveRequest) => {
    nudge(request.direction, request.pixels);
  });
}
