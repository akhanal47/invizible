import { app, safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

export class SettingsStore {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private apiKey: string | null = null;
  private sttApiKey: string | null = null;

  async load(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    this.settings = await this.readSettings();
    this.apiKey = await this.readApiKey(this.apiKeyPath);
    this.sttApiKey = await this.readApiKey(join(this.directory, STT_API_KEY_FILE));
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

  async update(update: SettingsUpdate): Promise<SettingsView> {
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
      this.sttApiKey &&
      sttApiKey === undefined
    ) {
      throw new Error('Enter a transcription key for the new endpoint, or clear the saved key.');
    }
    if ((apiKey || sttApiKey) && !safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure key storage is unavailable on this system.');
    }
    if (apiKey !== undefined) {
      await writeFile(
        this.apiKeyPath,
        apiKey ? safeStorage.encryptString(apiKey).toString('base64') : '',
        'utf8'
      );
      this.apiKey = apiKey || null;
    }
    if (sttApiKey !== undefined) {
      await writeFile(
        join(this.directory, STT_API_KEY_FILE),
        sttApiKey ? safeStorage.encryptString(sttApiKey).toString('base64') : '',
        'utf8'
      );
      this.sttApiKey = sttApiKey || null;
    }
    await writeFile(this.settingsPath, JSON.stringify(next, null, 2), 'utf8');
    this.settings = next;
    return this.getView();
  }

  private get directory(): string {
    return app.getPath('userData');
  }

  private get settingsPath(): string {
    return join(this.directory, SETTINGS_FILE);
  }

  private get apiKeyPath(): string {
    return join(this.directory, API_KEY_FILE);
  }

  private async readSettings(): Promise<Settings> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.settingsPath, 'utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        return { ...DEFAULT_SETTINGS };
      const candidate = { ...DEFAULT_SETTINGS, ...parsed } as Settings;
      return validateSettingsUpdate(candidate).length === 0 ? candidate : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private async readApiKey(path: string): Promise<string | null> {
    try {
      const encoded = await readFile(path, 'utf8');
      if (!encoded || !safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    } catch {
      return null;
    }
  }
}
