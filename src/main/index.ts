import { app, BrowserWindow, Menu } from 'electron';
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
import { registerIpcHandlers } from './ipc-router';
import { terminateOcr } from './ocr';
import { SettingsStore } from './settings-store';
import { IPC } from '../shared/ipc-contract';
import { createOverlayWindow, getWindow, nudge, toggleVisibility } from './window';

const settingsStore = new SettingsStore();

async function start(): Promise<void> {
  await app.whenReady();
  Menu.setApplicationMenu(null);
  if (process.platform === 'darwin') app.dock?.hide();

  await settingsStore.load();
  createOverlayWindow();
  registerIpcHandlers(settingsStore);
  registerHotkeys({
    toggleVisibility,
    nudge,
    capture: () => getWindow().webContents.send(IPC.uiAction, 'capture'),
    toggleMic: () => getWindow().webContents.send(IPC.uiAction, 'toggle-mic')
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow();
  });
}

app.on('will-quit', () => {
  unregisterHotkeys();
  void terminateOcr();
});
void start();
