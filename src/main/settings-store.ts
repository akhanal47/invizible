import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DEFAULT_SETTINGS,
  type Settings,
  type SettingsUpdate,
  type SettingsView,
  validateSettingsUpdate
} from '../shared/settings';

const SETTINGS_FILE = 'settings.json';
const API_KEY_FILE = 'api-key.bin';
const STT_API_KEY_FILE = 'stt-api-key.bin';

interface StoredSettings {
  version: 1;
  settings: Settings;
  encryptedApiKey: string | null;
  encryptedSttApiKey: string | null;
}

export class SettingsStore {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private apiKey: string | null = null;
  private sttApiKey: string | null = null;
  private encryptedApiKey: string | null = null;
  private encryptedSttApiKey: string | null = null;
  private pendingUpdate: Promise<unknown> = Promise.resolve();

  async load(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    try {
      const parsed: unknown = JSON.parse(await readFile(this.settingsPath, 'utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
      const stored = parsed as Partial<StoredSettings>;
      const isLegacy = !('version' in parsed);
      if (!isLegacy && stored.version !== 1) return;
      const savedSettings = isLegacy ? parsed : stored.settings;
      if (
        typeof savedSettings !== 'object' ||
        savedSettings === null ||
        Array.isArray(savedSettings)
      )
        return;
      // Only expose known settings, never fields containing encrypted credentials.
      const candidate = { ...DEFAULT_SETTINGS };
      for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
        if (key in savedSettings)
          Object.assign(candidate, { [key]: Reflect.get(savedSettings, key) });
      }
      if (validateSettingsUpdate(candidate).length > 0) return;
      if (
        !isLegacy &&
        ((stored.encryptedApiKey !== null && typeof stored.encryptedApiKey !== 'string') ||
          (stored.encryptedSttApiKey !== null && typeof stored.encryptedSttApiKey !== 'string'))
      )
        return;
      const encryptedApiKey = isLegacy
        ? await this.readLegacyKey(API_KEY_FILE)
        : (stored.encryptedApiKey ?? null);
      const encryptedSttApiKey = isLegacy
        ? await this.readLegacyKey(STT_API_KEY_FILE)
        : (stored.encryptedSttApiKey ?? null);
      this.settings = candidate;
      this.encryptedApiKey = encryptedApiKey;
      this.encryptedSttApiKey = encryptedSttApiKey;
      this.apiKey = this.decryptKey(encryptedApiKey);
      this.sttApiKey = this.decryptKey(encryptedSttApiKey);
    } catch {
      // Never attach separately stored keys to default endpoints after a corrupt settings read.
    }
  }

  getView(): SettingsView {
    return {
      ...this.settings,
      hasApiKey: this.apiKey !== null,
      hasSttApiKey: this.sttApiKey !== null
    };
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  getSttApiKey(): string | null {
    if (this.sttApiKey) return this.sttApiKey;
    const endpoint = this.settings.sttBaseUrl ?? this.settings.baseUrl;
    return endpoint.replace(/\/+$/, '') === this.settings.baseUrl.replace(/\/+$/, '')
      ? this.apiKey
      : null;
  }

  update(update: SettingsUpdate): Promise<SettingsView> {
    // Validate each update against the last committed state, including concurrent IPC calls.
    const snapshot = { ...update };
    const result = this.pendingUpdate.then(() => this.commitUpdate(snapshot));
    this.pendingUpdate = result.catch(() => undefined);
    return result;
  }

  private async commitUpdate(update: SettingsUpdate): Promise<SettingsView> {
    const errors = validateSettingsUpdate(update);
    if (errors.length > 0) throw new Error(errors.join(' '));

    const { apiKey, sttApiKey, ...nonSensitiveUpdate } = update;
    const next = { ...this.settings, ...nonSensitiveUpdate };
    if (
      next.baseUrl.replace(/\/+$/, '') !== this.settings.baseUrl.replace(/\/+$/, '') &&
      !apiKey?.trim()
    ) {
      throw new Error('Enter an API key for the new endpoint.');
    }
    if (
      (next.sttBaseUrl ?? next.baseUrl).replace(/\/+$/, '') !==
        (this.settings.sttBaseUrl ?? this.settings.baseUrl).replace(/\/+$/, '') &&
      this.encryptedSttApiKey &&
      sttApiKey === undefined
    ) {
      throw new Error('Enter a transcription key for the new endpoint, or clear the saved key.');
    }
    if ((apiKey || sttApiKey) && !safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure key storage is unavailable on this system.');
    }
    const encryptedApiKey = this.encryptUpdate(apiKey, this.encryptedApiKey);
    const encryptedSttApiKey = this.encryptUpdate(sttApiKey, this.encryptedSttApiKey);
    const stored: StoredSettings = {
      version: 1,
      settings: next,
      encryptedApiKey,
      encryptedSttApiKey
    };
    // One same-directory rename commits endpoints and encrypted keys together.
    const temporaryPath = `${this.settingsPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(stored, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx'
      });
      await rename(temporaryPath, this.settingsPath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
    // No await between publishing the new settings and credentials.
    this.settings = next;
    this.encryptedApiKey = encryptedApiKey;
    this.encryptedSttApiKey = encryptedSttApiKey;
    if (apiKey !== undefined) this.apiKey = apiKey || null;
    if (sttApiKey !== undefined) this.sttApiKey = sttApiKey || null;

    // Legacy files are no longer read once the versioned record has been committed.
    await Promise.all(
      [API_KEY_FILE, STT_API_KEY_FILE].map((file) =>
        rm(join(this.directory, file), { force: true }).catch(() => undefined)
      )
    );
    return this.getView();
  }

  private get directory(): string {
    return app.getPath('userData');
  }

  private get settingsPath(): string {
    return join(this.directory, SETTINGS_FILE);
  }

  private encryptUpdate(value: string | undefined, previous: string | null): string | null {
    if (value === undefined) return previous;
    return value ? safeStorage.encryptString(value).toString('base64') : null;
  }

  private async readLegacyKey(file: string): Promise<string | null> {
    try {
      return (await readFile(join(this.directory, file), 'utf8')) || null;
    } catch {
      return null;
    }
  }

  private decryptKey(encoded: string | null): string | null {
    try {
      if (!encoded || !safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    } catch {
      return null;
    }
  }
}
