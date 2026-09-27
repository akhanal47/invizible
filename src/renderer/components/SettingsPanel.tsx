import { type FormEvent, type JSX, useState } from 'react';
import type { SettingsUpdate, SettingsView } from '../../shared/settings';
import {
  PROVIDERS,
  providerForUrl,
  isLocalEndpoint,
  type ProviderId
} from '../../shared/providers';
import { Icon } from './Icon';
import { Modal } from './Modal';

interface SettingsPanelProps {
  settings: SettingsView;
  onClose(): void;
  onSave(update: SettingsUpdate): Promise<void>;
  onTest(): Promise<void>;
}

export function SettingsPanel({
  settings,
  onClose,
  onSave,
  onTest
}: SettingsPanelProps): JSX.Element {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(providerForUrl(settings.baseUrl));
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [models, setModels] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [voiceProvider, setVoiceProvider] = useState(settings.sttProvider);
  const local = isLocalEndpoint(baseUrl);
  const voiceChanged = voiceProvider !== settings.sttProvider;

  async function loadModels(): Promise<void> {
    setBusy(true);
    setMessage('Loading available models…');
    try {
      const available = await window.assistantApi.chat.models(
        baseUrl.trim().replace(/\/+$/, ''),
        apiKey.trim() || undefined
      );
      setModels(available);
      if (!available.includes(model)) setModel(available[0] ?? '');
      setMessage(
        available.length
          ? 'Models loaded. Choose a model below.'
          : 'No models found. Load a model in your server, then try again.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reach the model server.');
    } finally {
      setBusy(false);
    }
  }

  const preset = PROVIDERS.find((item) => item.id === provider);
  const endpointChanged = baseUrl.replace(/\/+$/, '') !== settings.baseUrl.replace(/\/+$/, '');

  function chooseProvider(id: ProviderId): void {
    setProvider(id);
    setApiKey('');
    setModels([]);
    const next = PROVIDERS.find((item) => item.id === id);
    if (next) {
      setBaseUrl(next.baseUrl);
      setModel(next.models[0] ?? '');
    }
    setMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const testAfterSave =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'test';
    const apiKey = String(form.get('apiKey') ?? '').trim();
    const sttApiKey = String(form.get('sttApiKey') ?? '').trim();
    setBusy(true);
    setMessage(testAfterSave ? 'Saving and testing connection…' : '');
    try {
      await onSave({
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        sttProvider: voiceProvider,
        liveSttModel: String(form.get('liveSttModel') ?? settings.liveSttModel).trim(),
        liveSttLanguage: String(form.get('liveSttLanguage') ?? settings.liveSttLanguage).trim(),
        sttBaseUrl:
          String(form.get('sttBaseUrl') ?? settings.sttBaseUrl ?? '')
            .trim()
            .replace(/\/+$/, '') || null,
        model: model.trim(),
        sttModel: String(form.get('sttModel') ?? settings.sttModel).trim(),
        reasoningEffort: String(form.get('reasoningEffort')) as SettingsView['reasoningEffort'],
        maxOutputTokens: Number(form.get('maxOutputTokens')),
        contextBudgetTokens: Number(form.get('contextBudgetTokens')),
        systemPrompt: String(form.get('systemPrompt') ?? ''),
        baseUserPrompt: String(form.get('baseUserPrompt') ?? ''),
        debugLogging: form.get('debugLogging') === 'on',
        ...(apiKey ? { apiKey } : form.get('clearChatKey') === 'on' ? { apiKey: '' } : {}),
        ...(form.get('clearSttKey') === 'on'
          ? { sttApiKey: '' }
          : sttApiKey
            ? { sttApiKey }
            : voiceChanged
              ? { sttApiKey: '' }
              : {})
      });
      if (testAfterSave) {
        await onTest();
        setMessage('Settings saved. Connection successful.');
      } else onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal label="Settings" onClose={onClose}>
      <form className="settings-panel" onSubmit={submit}>
        <div className="settings-heading">
          <div>
            <h2>Make it yours</h2>
            <p>Choose a model. Find your flow.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="settings-scroll">
          <fieldset disabled={busy} className="settings-fields">
            <div className="section-label">CONNECTION</div>
            <label>
              Provider
              <select
                value={provider}
                onChange={(event) => chooseProvider(event.target.value as ProviderId)}
              >
                {PROVIDERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value="custom">Custom endpoint</option>
              </select>
            </label>
            <label>
              Model
              <input
                name="model"
                list="chat-models"
                required
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Select or enter a model ID"
              />
            </label>
            <datalist id="chat-models">
              {(models.length
                ? models
                : preset
                  ? preset.models
                  : PROVIDERS.flatMap((item) => [...item.models])
              ).map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            {(local || provider === 'custom') && (
              <>
                <button type="button" className="secondary" onClick={() => void loadModels()}>
                  Load models
                </button>
                <p className="field-hint">
                  Start Ollama or llama-server first. Choose an installed model that fits your
                  available memory. Voice transcription is configured separately below.
                </p>
              </>
            )}
            <label>
              {local ? 'API key (optional)' : 'API key'}
              <input
                key={provider}
                name="apiKey"
                type="password"
                required={endpointChanged && !local}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="new-password"
                placeholder={
                  settings.hasApiKey && !endpointChanged
                    ? 'Saved securely · leave blank to keep'
                    : local
                      ? 'Leave blank unless your server requires a key'
                      : 'Enter your provider API key'
                }
              />
            </label>
            {local && settings.hasApiKey && !endpointChanged && (
              <label className="checkbox-label">
                <input type="checkbox" name="clearChatKey" />
                Remove saved local server key
              </label>
            )}
            {endpointChanged && !local && (
              <p className="field-hint">Enter a key for this endpoint to switch providers.</p>
            )}
            <details
              className="settings-section"
              open={provider === 'custom' || local ? true : undefined}
            >
              <summary>
                Endpoint & generation
                <Icon name="chevron" size={18} />
              </summary>
              <label>
                API base URL
                <input
                  name="baseUrl"
                  type="url"
                  required
                  value={baseUrl}
                  onChange={(event) => {
                    setBaseUrl(event.target.value);
                    setModels([]);
                    setApiKey('');
                  }}
                />
              </label>
              <div className="setting-grid">
                <label>
                  Reasoning
                  <select name="reasoningEffort" defaultValue={settings.reasoningEffort}>
                    <option value="none">Provider default</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label>
                  Output token limit
                  <input
                    name="maxOutputTokens"
                    type="number"
                    required
                    min="1"
                    defaultValue={settings.maxOutputTokens}
                  />
                </label>
              </div>
              <label>
                Context token budget
                <input
                  name="contextBudgetTokens"
                  type="number"
                  required
                  min="1"
                  defaultValue={settings.contextBudgetTokens}
                />
              </label>
            </details>
            <details className="settings-section">
              <summary>
                Voice input
                <Icon name="chevron" size={18} />
              </summary>
              <label>
                Voice provider
                <select
                  value={voiceProvider}
                  onChange={(event) =>
                    setVoiceProvider(event.target.value as SettingsView['sttProvider'])
                  }
                >
                  <option value="compatible">Record then transcribe (API)</option>
                  <option value="deepgram">Deepgram · live streaming</option>
                </select>
              </label>
              <p className="field-hint">
                {voiceProvider === 'deepgram'
                  ? 'Microphone audio streams to Deepgram while listening. Finalized words appear in your draft; review before sending. Requires a Deepgram API key and usage credit.'
                  : 'Audio is uploaded after you stop. Use an OpenAI-compatible transcription API, independently of your chat model.'}
              </p>
              {voiceProvider === 'compatible' ? (
                <>
                  <label>
                    Transcription base URL
                    <input
                      name="sttBaseUrl"
                      type="url"
                      defaultValue={settings.sttBaseUrl ?? ''}
                      placeholder="Blank uses your chat endpoint"
                    />
                  </label>
                  {local && (
                    <p className="field-hint">
                      Local chat servers do not transcribe audio. Enter a cloud transcription URL
                      and key, or choose Deepgram live streaming.
                    </p>
                  )}
                  <label>
                    Transcription model
                    <input name="sttModel" required defaultValue={settings.sttModel} />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Live model
                    <input name="liveSttModel" required defaultValue={settings.liveSttModel} />
                  </label>
                  <label>
                    Language
                    <input
                      name="liveSttLanguage"
                      required
                      defaultValue={settings.liveSttLanguage}
                      placeholder="en, or a supported language code"
                    />
                  </label>
                </>
              )}
              <label>
                {voiceProvider === 'deepgram' ? 'Deepgram API key' : 'Transcription API key'}
                <input
                  key={voiceProvider}
                  name="sttApiKey"
                  type="password"
                  autoComplete="new-password"
                  required={
                    voiceProvider === 'deepgram' && (voiceChanged || !settings.hasSttApiKey)
                  }
                  placeholder={
                    settings.hasSttApiKey && !voiceChanged
                      ? 'Saved securely · leave blank to keep'
                      : 'Enter your transcription provider key'
                  }
                />
              </label>
              {settings.hasSttApiKey && !voiceChanged && (
                <label className="checkbox-label">
                  <input type="checkbox" name="clearSttKey" />
                  Remove saved transcription key
                </label>
              )}
            </details>
            <details className="settings-section">
              <summary>
                Instructions & preferences
                <Icon name="chevron" size={18} />
              </summary>
              <label>
                System instructions
                <textarea name="systemPrompt" rows={3} defaultValue={settings.systemPrompt} />
              </label>
              <label>
                Prompt template
                <textarea
                  name="baseUserPrompt"
                  rows={3}
                  defaultValue={settings.baseUserPrompt}
                  placeholder="Optional instructions for every message"
                />
              </label>
              <p className="field-hint">
                Use {'{{screen_text}}'} or {'{{transcript}}'} to include captured context.
              </p>
              <label className="checkbox-label">
                <input name="debugLogging" type="checkbox" defaultChecked={settings.debugLogging} />{' '}
                Save local debug logs
              </label>
              <p className="field-hint">Logs may contain conversation content.</p>
            </details>
          </fieldset>
        </div>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
        <div className="settings-actions">
          <button type="submit" value="test" className="secondary" disabled={busy}>
            Save & test
          </button>
          <button type="submit" value="save" disabled={busy}>
            {busy ? 'Working…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
