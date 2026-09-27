import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const state = vi.hoisted(() => ({ directory: '' }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: vi.fn(actual.writeFile), rename: vi.fn(actual.rename) };
});
vi.mock('electron', () => ({
  app: { getPath: () => state.directory },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^encrypted:/, '')
  }
}));
import { SettingsStore } from './settings-store';
import { DEFAULT_SETTINGS } from '../shared/settings';

afterEach(async () => {
  vi.clearAllMocks();
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

  it.each(['write', 'rename'] as const)(
    'preserves both provider/key pairs when the %s fails',
    async (failure) => {
      const store = await createStore();
      await store.update({ sttBaseUrl: 'https://voice.example.com/v1', sttApiKey: 'voice-test' });
      const previous = store.getView();
      const previousFile = await readFile(join(state.directory, 'settings.json'), 'utf8');
      if (failure === 'write')
        vi.mocked(writeFile).mockRejectedValueOnce(new Error('Disk failure'));
      else vi.mocked(rename).mockRejectedValueOnce(new Error('Disk failure'));

      await expect(
        store.update({
          baseUrl: 'https://new-chat.example.com/v1',
          apiKey: 'new-chat-key',
          sttBaseUrl: 'https://new-voice.example.com/v1',
          sttApiKey: 'new-voice-key'
        })
      ).rejects.toThrow('Disk failure');

      expect(store.getView()).toEqual(previous);
      expect(store.getApiKey()).toBe('openai-test');
      expect(store.getSttApiKey()).toBe('voice-test');
      expect(await readFile(join(state.directory, 'settings.json'), 'utf8')).toBe(previousFile);
      expect((await readdir(state.directory)).filter((file) => file.endsWith('.tmp'))).toEqual([]);
      const reloaded = new SettingsStore();
      await reloaded.load();
      expect(reloaded.getView()).toEqual(previous);
      expect(reloaded.getApiKey()).toBe('openai-test');
      expect(reloaded.getSttApiKey()).toBe('voice-test');
      // A failed commit must not poison the save queue.
      await store.update({ model: 'updated-model' });
      expect(store.getView().model).toBe('updated-model');
    }
  );

  it('keeps requests on the old pair during a save and serializes overlapping updates', async () => {
    const store = await createStore();
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const committing = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.mocked(rename).mockImplementationOnce(async (from, to) => {
      started();
      await gate;
      await actual.rename(from, to);
    });
    const switchProvider = store.update({
      baseUrl: 'https://new-chat.example.com/v1',
      apiKey: 'new-chat-key'
    });
    await committing;
    const updateModel = store.update({ model: 'updated-model' });
    try {
      expect(store.getView().baseUrl).toBe(DEFAULT_SETTINGS.baseUrl);
      expect(store.getApiKey()).toBe('openai-test');
    } finally {
      release();
      await Promise.all([switchProvider, updateModel]);
    }
    const reloaded = new SettingsStore();
    await reloaded.load();
    for (const current of [store, reloaded]) {
      expect(current.getView().baseUrl).toBe('https://new-chat.example.com/v1');
      expect(current.getView().model).toBe('updated-model');
      expect(current.getApiKey()).toBe('new-chat-key');
    }
  });

  it('migrates legacy files on save and never exposes encrypted keys through the view', async () => {
    state.directory = await mkdtemp(join(tmpdir(), 'overlay-settings-'));
    await writeFile(
      join(state.directory, 'settings.json'),
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        baseUrl: 'https://legacy.example.com/v1'
      })
    );
    await writeFile(
      join(state.directory, 'api-key.bin'),
      Buffer.from('encrypted:legacy-chat').toString('base64')
    );
    await writeFile(
      join(state.directory, 'stt-api-key.bin'),
      Buffer.from('encrypted:legacy-voice').toString('base64')
    );
    const store = new SettingsStore();
    await store.load();
    expect(store.getApiKey()).toBe('legacy-chat');
    expect(store.getSttApiKey()).toBe('legacy-voice');
    await store.update({ model: 'updated-model' });
    expect(await readdir(state.directory)).toEqual(['settings.json']);
    const saved = await readFile(join(state.directory, 'settings.json'), 'utf8');
    expect(saved).not.toContain('legacy-chat');
    expect(saved).not.toContain('legacy-voice');
    const reloaded = new SettingsStore();
    await reloaded.load();
    expect(reloaded.getApiKey()).toBe('legacy-chat');
    expect(reloaded.getSttApiKey()).toBe('legacy-voice');
    expect(reloaded.getView()).not.toHaveProperty('encryptedApiKey');
    expect(reloaded.getView()).not.toHaveProperty('encryptedSttApiKey');
    await reloaded.update({ apiKey: '', sttApiKey: '' });
    const cleared = new SettingsStore();
    await cleared.load();
    expect(cleared.getApiKey()).toBeNull();
    expect(cleared.getSttApiKey()).toBeNull();
  });

  it('does not load orphaned legacy keys when settings are corrupt', async () => {
    state.directory = await mkdtemp(join(tmpdir(), 'overlay-settings-'));
    await writeFile(join(state.directory, 'settings.json'), '{invalid');
    await writeFile(
      join(state.directory, 'api-key.bin'),
      Buffer.from('encrypted:legacy-chat').toString('base64')
    );
    const store = new SettingsStore();
    await store.load();
    expect(store.getApiKey()).toBeNull();
    expect(store.getSttApiKey()).toBeNull();
  });
});
