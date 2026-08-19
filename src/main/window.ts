import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

let overlayWindow: BrowserWindow | null = null;
let contentProtectionEnabled = false;

export function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  overlayWindow = new BrowserWindow({
    title: 'Invisible AI Overlay',
    width: 560,
    height: 680,
    x: Math.round((width - 560) / 2),
    y: Math.round((height - 680) / 2),
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#111827',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyContentProtection(overlayWindow);
  overlayWindow.once('ready-to-show', () => overlayWindow?.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void overlayWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void overlayWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    contentProtectionEnabled = false;
  });
  return overlayWindow;
}

function applyContentProtection(window: BrowserWindow): void {
  window.setContentProtection(true);
  contentProtectionEnabled = true;
}

export function toggleVisibility(): void {
  const window = getWindow();
  if (window.isVisible()) {
    window.hide();
    return;
  }
  applyContentProtection(window);
  window.show();
  window.focus();
}

export function closeOverlay(): void {
  app.quit();
}

export function nudge(direction: 'up' | 'down' | 'left' | 'right', pixels = 40): void {
  const window = getWindow();
  const [savedX, savedY] = window.getPosition();
  const x = savedX ?? 0;
  const y = savedY ?? 0;
  const offsets: Record<'up' | 'down' | 'left' | 'right', [number, number]> = {
    up: [0, -pixels],
    down: [0, pixels],
    left: [-pixels, 0],
    right: [pixels, 0]
  };
  const offset = offsets[direction];
  window.setPosition(x + offset[0], y + offset[1]);
}

export function getWindow(): BrowserWindow {
  if (!overlayWindow || overlayWindow.isDestroyed()) throw new Error('Overlay window is unavailable.');
  return overlayWindow;
}

export function isContentProtected(): boolean {
  return contentProtectionEnabled;
}
