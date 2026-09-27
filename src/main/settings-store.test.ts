import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const state = vi.hoisted(() => ({ directory: '' }));
vi.mock('electron', () => ({
  app: { getPath: () => state.directory },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^encrypted:/, '')
  }
}));
import { SettingsStore } from './settings-store';

afterEach(async () => {
  if (state.directory) await rm(state.directory, { recursive: true, force: true });
});
async function createStore() {
  state.directory = await mkdtemp(join(tmpdir(), 'overlay-settings-'));
  const store = new SettingsStore();
  await store.load();
  await store.update({ apiKey: 'openai-test' });
  return store;
}

describe('provider credentials', () => {
  it('does not reuse the saved chat key for a new provider', async () => {
    const store = await createStore();
    await expect(store.update({ baseUrl: 'https://api.anthropic.com/v1' })).rejects.toThrow(
      'Enter an API key'
    );
    expect(store.getView().baseUrl).toBe('https://api.openai.com/v1');
    await store.update({
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-5',
      apiKey: 'claude-test'
    });
    expect(store.getApiKey()).toBe('claude-test');
  });

  it('persists a separate transcription key without exposing it in settings', async () => {
    const store = await createStore();
    await store.update({ sttBaseUrl: 'https://voice.example.com/v1' });
    expect(store.getSttApiKey()).toBeNull();
    await store.update({ sttApiKey: 'voice-test' });
    const reloaded = new SettingsStore();
    await reloaded.load();
    expect(reloaded.getSttApiKey()).toBe('voice-test');
    expect(reloaded.getView().hasSttApiKey).toBe(true);
    expect(await readFile(join(state.directory, 'settings.json'), 'utf8')).not.toContain(
      'voice-test'
    );
    await expect(reloaded.update({ sttBaseUrl: 'https://other.example.com/v1' })).rejects.toThrow(
      'transcription key'
    );
    await reloaded.update({ sttApiKey: '' });
    expect(reloaded.getSttApiKey()).toBeNull();
  });
});
