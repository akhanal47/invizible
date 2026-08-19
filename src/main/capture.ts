import { desktopCapturer, systemPreferences } from 'electron';
import type { CaptureSource } from '../shared/ipc-contract';

const THUMBNAIL_SIZE = { width: 360, height: 220 };
const FULL_SIZE = { width: 4096, height: 4096 };

function screenRecordingError(): Error {
  return new Error(
    'Screen Recording permission is required to capture text. Open System Settings → Privacy & Security → Screen Recording, enable Invisible AI Overlay, then quit and reopen the app.'
  );
}

function checkScreenRecordingPermission(): void {
  if (process.platform !== 'darwin') return;
  const status = systemPreferences.getMediaAccessStatus('screen');
  if (status === 'denied' || status === 'restricted') throw screenRecordingError();
}

async function getSources(thumbnailSize: { width: number; height: number }) {
  checkScreenRecordingPermission();
  try {
    return await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize });
  } catch (error) {
    if (process.platform === 'darwin') throw new Error(screenRecordingError().message, { cause: error });
    throw new Error(`Unable to enumerate capture sources: ${error instanceof Error ? error.message : 'unknown error'}`, { cause: error });
  }
}

export async function listSources(): Promise<CaptureSource[]> {
  const sources = await getSources(THUMBNAIL_SIZE);
  return sources
    .filter((source) => source.name !== 'Invisible AI Overlay')
    .map((source) => ({
      id: source.id,
      name: source.name || 'Untitled window',
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnailDataUrl: source.thumbnail.isEmpty() ? '' : source.thumbnail.toDataURL()
    }));
}

export async function grabSource(sourceId: string): Promise<{ png: Buffer; imageWidth: number; imageHeight: number }> {
  const sources = await getSources(FULL_SIZE);
  const source = sources.find((candidate) => candidate.id === sourceId);
  if (!source || source.thumbnail.isEmpty()) {
    throw process.platform === 'darwin' ? screenRecordingError() : new Error('Unable to capture that source.');
  }
  const { width: imageWidth, height: imageHeight } = source.thumbnail.getSize();
  return { png: source.thumbnail.toPNG(), imageWidth, imageHeight };
}
