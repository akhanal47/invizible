import { globalShortcut } from 'electron';

export interface HotkeyStatus {
  accelerator: string;
  registered: boolean;
}

export interface HotkeyActions {
  toggleVisibility(): void;
  nudge(direction: 'up' | 'down' | 'left' | 'right'): void;
  capture(): void;
  toggleMic(): void;
}

export function registerHotkeys(actions: HotkeyActions): HotkeyStatus[] {
  const hotkeys: Array<[string, () => void]> = [
    ['CommandOrControl+Shift+Space', actions.toggleVisibility],
    ['CommandOrControl+Shift+S', actions.capture],
    ['CommandOrControl+Shift+M', actions.toggleMic],
    ['CommandOrControl+Shift+Up', () => actions.nudge('up')],
    ['CommandOrControl+Shift+Down', () => actions.nudge('down')],
    ['CommandOrControl+Shift+Left', () => actions.nudge('left')],
    ['CommandOrControl+Shift+Right', () => actions.nudge('right')]
  ];
  return hotkeys.map(([accelerator, callback]) => ({
    accelerator,
    registered: globalShortcut.register(accelerator, callback)
  }));
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
}
