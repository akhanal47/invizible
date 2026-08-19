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

export class SettingsStore {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private apiKey: string | null = null;

  async load(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    this.settings = await this.readSettings();
    this.apiKey = await this.readApiKey();
  }

  getView(): SettingsView {
    return { ...this.settings, hasApiKey: this.apiKey !== null };
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  async update(update: SettingsUpdate): Promise<SettingsView> {
    const errors = validateSettingsUpdate(update);
    if (errors.length > 0) throw new Error(errors.join(' '));

    const { apiKey, ...nonSensitiveUpdate } = update;
    this.settings = { ...this.settings, ...nonSensitiveUpdate };
    await writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8');

    if (apiKey !== undefined) {
      if (apiKey === '') {
        this.apiKey = null;
        await writeFile(this.apiKeyPath, '', 'utf8');
      } else {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('Secure key storage is unavailable on this system.');
        }
        this.apiKey = apiKey;
        await writeFile(this.apiKeyPath, safeStorage.encryptString(apiKey).toString('base64'), 'utf8');
      }
    }
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
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...DEFAULT_SETTINGS };
      const candidate = { ...DEFAULT_SETTINGS, ...parsed } as Settings;
      return validateSettingsUpdate(candidate).length === 0 ? candidate : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private async readApiKey(): Promise<string | null> {
    try {
      const encoded = await readFile(this.apiKeyPath, 'utf8');
      if (!encoded || !safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    } catch {
      return null;
    }
  }
}
