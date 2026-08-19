import { desktopCapturer } from 'electron';
import type { CaptureSource } from '../shared/ipc-contract';

const THUMBNAIL_SIZE = { width: 360, height: 220 };
const FULL_SIZE = { width: 4096, height: 4096 };

export async function listSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: THUMBNAIL_SIZE });
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
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: FULL_SIZE });
  const source = sources.find((candidate) => candidate.id === sourceId);
  if (!source || source.thumbnail.isEmpty()) {
    const permissionHint = process.platform === 'darwin' ? ' Grant Screen Recording permission in System Settings, then restart the app.' : '';
    throw new Error(`Unable to capture that source.${permissionHint}`);
  }
  const { width: imageWidth, height: imageHeight } = source.thumbnail.getSize();
  return { png: source.thumbnail.toPNG(), imageWidth, imageHeight };
}
