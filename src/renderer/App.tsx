import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, PendingAttachment, StreamEvent } from '../shared/chat-types';
import type { CaptureSource } from '../shared/ipc-contract';
import type { SettingsUpdate, SettingsView } from '../shared/settings';
import { ChatView } from './components/ChatView';
import { InputBar } from './components/InputBar';
import { SettingsPanel } from './components/SettingsPanel';
import { SourcePicker } from './components/SourcePicker';
import { assembleMessages, estimateTokens } from './lib/prompt';

const emptySettings: SettingsView = { baseUrl: '', sttBaseUrl: null, model: '', sttModel: '', reasoningEffort: 'none', maxOutputTokens: 1_000, contextBudgetTokens: 12_000, systemPrompt: '', baseUserPrompt: '', debugLogging: false, hasApiKey: false };

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<SettingsView>(emptySettings);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [status, setStatus] = useState('Protected overlay ready');
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [sources, setSources] = useState<CaptureSource[] | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [isRecording, setRecording] = useState(false);
  const requestId = useRef<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const handleStream = useCallback((event: StreamEvent): void => {
    if (event.requestId !== requestId.current) return;
    if (event.type === 'delta') {
      setMessages((previous) => previous.map((message, index) => index === previous.length - 1 ? { ...message, content: message.content + event.text } : message));
    } else if (event.type === 'notice') {
      setStatus(event.text);
    } else if (event.type === 'done') {
      requestId.current = null;
      setStatus('Response complete.');
    } else {
      requestId.current = null;
      setStatus(event.error.message);
      setMessages((previous) => previous.filter((message, index) => index !== previous.length - 1 || message.content.length > 0));
    }
  }, []);

  useEffect(() => {
    void window.assistantApi.settings.get().then(setSettings).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Unable to load settings.'));
    return window.assistantApi.chat.onStream(handleStream);
  }, [handleStream]);

  const openCapture = useCallback(async () => {
    setStatus('Loading capture sources…');
    setCaptureError(null);
    try {
      setSources(await window.assistantApi.capture.listSources());
      setStatus('Choose a screen or window for OCR.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to list sources.';
      setCaptureError(message);
      setStatus('Capture permission is needed.');
    }
  }, []);

  const toggleMic = useCallback(async () => {
    if (recorder.current?.state === 'recording') {
      recorder.current.stop();
      return;
    }
    if (!settings.hasApiKey) {
      setStatus('Transcription in v1 uses your OpenAI-compatible API. Add an API key in Settings; local Whisper is a v2 feature.');
      setSettingsOpen(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined);
      chunks.current = [];
      nextRecorder.ondataavailable = (event) => chunks.current.push(event.data);
      nextRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const audio = new Blob(chunks.current, { type: nextRecorder.mimeType });
        setStatus('Transcribing…');
        void audio.arrayBuffer().then((buffer) => window.assistantApi.stt.transcribe({ audio: buffer, mimeType: audio.type })).then((text) => {
          if (!text) return setStatus('No speech was detected.');
          setInput((previous) => [previous.trim(), text].filter(Boolean).join(previous.trim() ? '\n' : ''));
          setAttachments((previous) => [...previous, { id: crypto.randomUUID(), type: 'transcript', text }]);
          setStatus('Transcript inserted. Press Enter when ready to send.');
        }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Transcription failed.'));
      };
      recorder.current = nextRecorder;
      nextRecorder.start();
      setRecording(true);
      setStatus('Recording… use the mic button or hotkey to stop.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Microphone access was denied.');
    }
  }, [settings.hasApiKey]);

  useEffect(() => window.assistantApi.ui.onAction((action) => {
    if (action === 'capture') void openCapture();
    if (action === 'toggle-mic') void toggleMic();
  }), [openCapture, toggleMic]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      if (requestId.current) void window.assistantApi.chat.abort(requestId.current);
      else if (sources) setSources(null);
      else setSettingsOpen(false);
    }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [sources]);

  function send(): void {
    if (requestId.current || (!input.trim() && attachments.length === 0)) return;
    const id = crypto.randomUUID();
    const userContent = input.trim() || 'Please review the attached context.';
    const requestMessages = assembleMessages(settings, messages, userContent, attachments);
    requestId.current = id;
    setMessages((previous) => [...previous, { role: 'user', content: userContent }, { role: 'assistant', content: '' }]);
    setInput('');
    setAttachments([]);
    setStatus('Streaming response…');
    void window.assistantApi.chat.send({ requestId: id, messages: requestMessages }).catch((error: unknown) => {
      if (requestId.current !== id) return;
      requestId.current = null;
      setStatus(error instanceof Error ? error.message : 'Unable to send chat request.');
    });
  }

  async function selectSource(sourceId: string): Promise<void> {
    setCaptureBusy(true);
    try {
      const result = await window.assistantApi.capture.grabAndOcr(sourceId);
      if (!result.text) throw new Error('No readable text was found in that capture.');
      setAttachments((previous) => [...previous, { id: crypto.randomUUID(), type: 'screen_text', text: result.text, imageWidth: result.imageWidth, imageHeight: result.imageHeight }]);
      setStatus(`OCR added (${result.durationMs}ms).`);
      setSources(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'OCR failed.');
    } finally {
      setCaptureBusy(false);
    }
  }

  async function saveSettings(update: SettingsUpdate): Promise<void> {
    setSettings(await window.assistantApi.settings.set(update));
    setStatus('Settings saved securely.');
  }

  const isStreaming = requestId.current !== null;
  const pendingTokens = estimateTokens(assembleMessages(settings, [], input, attachments));
  return <main className="overlay-shell">
    <header className="titlebar"><span className="drag-region">Invisible AI</span><div className="window-actions"><button aria-label="Open settings" className="icon-button" onClick={() => setSettingsOpen(true)}>⚙</button><button aria-label="Close application" className="icon-button close-button" onClick={() => void window.assistantApi.overlay.close()}>×</button></div></header>
    <ChatView messages={messages} />
    <InputBar value={input} attachments={attachments} isStreaming={isStreaming} isRecording={isRecording} onChange={setInput} onSend={send} onAbort={() => requestId.current && void window.assistantApi.chat.abort(requestId.current)} onCapture={() => void openCapture()} onMic={() => void toggleMic()} onRemoveAttachment={(id) => setAttachments((previous) => previous.filter((item) => item.id !== id))} />
    <footer><span><span className="protected-dot" /> Protected · {status}</span><span>{settings.model || 'No model'} · ~{pendingTokens} tokens</span></footer>
    {isSettingsOpen && <SettingsPanel settings={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} onTest={() => window.assistantApi.chat.test()} />}
    {sources && <SourcePicker sources={sources} busy={captureBusy} onSelect={(sourceId) => void selectSource(sourceId)} onClose={() => !captureBusy && setSources(null)} />}
    {captureError && <div className="modal-backdrop" role="presentation"><section className="permission-panel" role="dialog" aria-modal="true" aria-label="Screen Recording permission required"><h2>Allow Screen Recording</h2><p>{captureError.replace(/^Error invoking remote method 'capture:list-sources': /, '')}</p><div className="settings-actions"><button className="secondary" onClick={() => setCaptureError(null)}>Cancel</button><button className="secondary" onClick={() => void openCapture()}>Retry</button><button onClick={() => void window.assistantApi.system.openScreenRecordingSettings()}>Open System Settings</button></div></section></div>}
  </main>;
}
