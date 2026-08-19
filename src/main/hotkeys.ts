import { globalShortcut } from 'electron';
import { nudge, toggleVisibility } from './window';

export interface HotkeyStatus {
  accelerator: string;
  registered: boolean;
}

const hotkeys: Array<[string, () => void]> = [
  ['CommandOrControl+Shift+Space', toggleVisibility],
  ['CommandOrControl+Shift+Up', () => nudge('up')],
  ['CommandOrControl+Shift+Down', () => nudge('down')],
  ['CommandOrControl+Shift+Left', () => nudge('left')],
  ['CommandOrControl+Shift+Right', () => nudge('right')]
];

export function registerHotkeys(): HotkeyStatus[] {
  return hotkeys.map(([accelerator, callback]) => ({
    accelerator,
    registered: globalShortcut.register(accelerator, callback)
  }));
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
}
