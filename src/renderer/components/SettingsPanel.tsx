import { type FormEvent, type JSX, useState } from 'react';
import type { SettingsUpdate, SettingsView } from '../../shared/settings';

interface SettingsPanelProps {
  settings: SettingsView;
  onClose(): void;
  onSave(update: SettingsUpdate): Promise<void>;
  onTest(): Promise<void>;
}

export function SettingsPanel({ settings, onClose, onSave, onTest }: SettingsPanelProps): JSX.Element {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const apiKey = String(form.get('apiKey') ?? '');
    setBusy(true);
    try {
      await onSave({
        baseUrl: String(form.get('baseUrl') ?? ''),
        sttBaseUrl: String(form.get('sttBaseUrl') ?? '') || null,
        model: String(form.get('model') ?? ''),
        sttModel: String(form.get('sttModel') ?? ''),
        reasoningEffort: String(form.get('reasoningEffort')) as SettingsView['reasoningEffort'],
        maxOutputTokens: Number(form.get('maxOutputTokens')),
        contextBudgetTokens: Number(form.get('contextBudgetTokens')),
        systemPrompt: String(form.get('systemPrompt') ?? ''),
        baseUserPrompt: String(form.get('baseUserPrompt') ?? ''),
        debugLogging: form.get('debugLogging') === 'on',
        ...(apiKey === '' ? {} : { apiKey })
      });
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  }
  async function test(): Promise<void> {
    setBusy(true);
    setMessage('Testing connection…');
    try {
      await onTest();
      setMessage('Connection succeeded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connection test failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="settings-panel" onSubmit={submit}>
        <div className="settings-heading"><h2>Connection settings</h2><button type="button" className="icon-button" onClick={onClose}>×</button></div>
        <label>API base URL<input name="baseUrl" type="url" required defaultValue={settings.baseUrl} /></label>
        <label>API key {settings.hasApiKey && <small>(saved — leave blank to keep it)</small>}<input name="apiKey" type="password" autoComplete="new-password" /></label>
        <div className="setting-grid"><label>Chat model<input name="model" required defaultValue={settings.model} /></label><label>Reasoning effort<select name="reasoningEffort" defaultValue={settings.reasoningEffort}><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
        <div className="setting-grid"><label>Max output tokens<input name="maxOutputTokens" type="number" min="1" defaultValue={settings.maxOutputTokens} /></label><label>Context budget<input name="contextBudgetTokens" type="number" min="1" defaultValue={settings.contextBudgetTokens} /></label></div>
        <label>STT base URL <small>(blank = API base URL)</small><input name="sttBaseUrl" type="url" defaultValue={settings.sttBaseUrl ?? ''} /></label>
        <label>STT model<input name="sttModel" required defaultValue={settings.sttModel} /></label>
        <label>System prompt<textarea name="systemPrompt" rows={3} defaultValue={settings.systemPrompt} /></label>
        <label>Base user prompt <small>supports {'{{screen_text}}'} and {'{{transcript}}'}</small><textarea name="baseUserPrompt" rows={3} defaultValue={settings.baseUserPrompt} /></label>
        <label className="checkbox-label"><input name="debugLogging" type="checkbox" defaultChecked={settings.debugLogging} /> Enable local debug logging (never enable with sensitive content)</label>
        {message && <p className="form-message">{message}</p>}
        <div className="settings-actions"><button type="button" className="secondary" disabled={busy} onClick={() => void test()}>Test connection</button><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>Save settings</button></div>
      </form>
    </div>
  );
}
