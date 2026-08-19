import { app, Menu } from 'electron';
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
import { registerIpcHandlers } from './ipc-router';
import { SettingsStore } from './settings-store';
import { createOverlayWindow } from './window';

const settingsStore = new SettingsStore();

async function start(): Promise<void> {
  await app.whenReady();
  Menu.setApplicationMenu(null);
  if (process.platform === 'darwin') app.dock.hide();

  await settingsStore.load();
  createOverlayWindow();
  registerIpcHandlers(settingsStore);
  registerHotkeys();

  app.on('activate', () => {
    if (app.getAllWindows().length === 0) createOverlayWindow();
  });
}

app.on('will-quit', unregisterHotkeys);
void start();
