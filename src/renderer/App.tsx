import { type FormEvent, useEffect, useState } from 'react';
import type { SettingsUpdate, SettingsView } from '../shared/settings';

const emptySettings: SettingsView = {
  baseUrl: '',
  sttBaseUrl: null,
  model: '',
  sttModel: '',
  reasoningEffort: 'none',
  maxOutputTokens: 1_000,
  contextBudgetTokens: 12_000,
  systemPrompt: '',
  baseUserPrompt: '',
  debugLogging: false,
  hasApiKey: false
};

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<SettingsView>(emptySettings);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState('Protected overlay ready');

  useEffect(() => {
    void window.assistantApi.settings
      .get()
      .then(setSettings)
      .catch(() => setStatus('Unable to load settings.'));
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const apiKey = String(form.get('apiKey') ?? '');
    const update: SettingsUpdate = {
      baseUrl: String(form.get('baseUrl') ?? ''),
      model: String(form.get('model') ?? ''),
      systemPrompt: String(form.get('systemPrompt') ?? ''),
      maxOutputTokens: Number(form.get('maxOutputTokens')),
      contextBudgetTokens: Number(form.get('contextBudgetTokens')),
      ...(apiKey === '' ? {} : { apiKey })
    };
    try {
      setSettings(await window.assistantApi.settings.set(update));
      setSettingsOpen(false);
      setStatus('Settings saved securely');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save settings.');
    }
  }

  return (
    <main className="overlay-shell">
      <header className="titlebar">
        <span className="drag-region">Invisible AI</span>
        <button aria-label="Open settings" className="icon-button" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
      </header>

      <section className="chat-empty-state">
        <div className="protected-mark">◈</div>
        <h1>Your private AI overlay</h1>
        <p>Configure your OpenAI-compatible API, then enter a prompt. Nothing is sent automatically.</p>
      </section>

      <section className="input-area">
        <textarea aria-label="Message" placeholder="Type a prompt…" rows={3} disabled />
        <div className="input-actions">
          <span>Chat unlocks after the streaming client is connected.</span>
          <button disabled>Send</button>
        </div>
      </section>

      <footer>
        <span className="protected-dot" /> Protected · {status}
        <span>{settings.model || 'No model selected'}</span>
      </footer>

      {isSettingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="settings-panel" onSubmit={saveSettings}>
            <div className="settings-heading">
              <h2>Connection settings</h2>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)}>
                ×
              </button>
            </div>
            <label>
              API base URL
              <input name="baseUrl" type="url" required defaultValue={settings.baseUrl} />
            </label>
            <label>
              API key {settings.hasApiKey ? <small>(saved)</small> : null}
              <input name="apiKey" type="password" autoComplete="new-password" placeholder="Leave blank to keep current key" />
            </label>
            <label>
              Model
              <input name="model" required defaultValue={settings.model} placeholder="gpt-4o-mini" />
            </label>
            <div className="setting-grid">
              <label>
                Max output tokens
                <input name="maxOutputTokens" type="number" min="1" defaultValue={settings.maxOutputTokens} />
              </label>
              <label>
                Context budget
                <input name="contextBudgetTokens" type="number" min="1" defaultValue={settings.contextBudgetTokens} />
              </label>
            </div>
            <label>
              System prompt
              <textarea name="systemPrompt" rows={4} defaultValue={settings.systemPrompt} />
            </label>
            <div className="settings-actions">
              <button type="button" className="secondary" onClick={() => setSettingsOpen(false)}>
                Cancel
              </button>
              <button type="submit">Save settings</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
