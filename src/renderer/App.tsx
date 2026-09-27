import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, PendingAttachment, StreamEvent } from '../shared/chat-types';
import type { CaptureSource } from '../shared/ipc-contract';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { supportsTranscription } from '../shared/providers';
import { Icon } from './components/Icon';
import type { SettingsUpdate, SettingsView } from '../shared/settings';
import { ChatView } from './components/ChatView';
import { InputBar } from './components/InputBar';
import { SettingsPanel } from './components/SettingsPanel';
import { SourcePicker } from './components/SourcePicker';

const emptySettings: SettingsView = { ...DEFAULT_SETTINGS, hasApiKey: false, hasSttApiKey: false };

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<SettingsView>(emptySettings);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [status, setStatus] = useState('Ready');
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
      setMessages((previous) =>
        previous.map((message, index) =>
          index === previous.length - 1
            ? { ...message, content: message.content + event.text }
            : message
        )
      );
    } else if (event.type === 'notice') {
      setStatus(event.text);
    } else if (event.type === 'done') {
      requestId.current = null;
      setStatus('Response complete.');
    } else {
      requestId.current = null;
      setStatus(event.error.message);
      setMessages((previous) =>
        previous.filter(
          (message, index) => index !== previous.length - 1 || message.content.length > 0
        )
      );
    }
  }, []);

  useEffect(() => {
    void window.assistantApi.settings
      .get()
      .then(setSettings)
      .catch((error: unknown) =>
        setStatus(error instanceof Error ? error.message : 'Unable to load settings.')
      );
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
    if (
      (!settings.hasSttApiKey && !settings.hasApiKey) ||
      !supportsTranscription(settings.sttBaseUrl ?? settings.baseUrl) ||
      (settings.sttBaseUrl &&
        settings.sttBaseUrl.replace(/\/+$/, '') !== settings.baseUrl.replace(/\/+$/, '') &&
        !settings.hasSttApiKey)
    ) {
      setStatus('Set up a transcription endpoint and key in Settings → Voice input.');
      setSettingsOpen(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(
        stream,
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? { mimeType: 'audio/webm;codecs=opus' }
          : undefined
      );
      chunks.current = [];
      nextRecorder.ondataavailable = (event) => chunks.current.push(event.data);
      nextRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const audio = new Blob(chunks.current, { type: nextRecorder.mimeType });
        setStatus('Transcribing…');
        void audio
          .arrayBuffer()
          .then((buffer) =>
            window.assistantApi.stt.transcribe({ audio: buffer, mimeType: audio.type })
          )
          .then((text) => {
            if (!text) return setStatus('No speech was detected.');
            setInput((previous) =>
              [previous.trim(), text].filter(Boolean).join(previous.trim() ? '\n' : '')
            );
            setAttachments((previous) => [
              ...previous,
              { id: crypto.randomUUID(), type: 'transcript', text }
            ]);
            setStatus('Transcript inserted. Press Enter when ready to send.');
          })
          .catch((error: unknown) =>
            setStatus(error instanceof Error ? error.message : 'Transcription failed.')
          );
      };
      recorder.current = nextRecorder;
      nextRecorder.start();
      setRecording(true);
      setStatus('Recording… use the mic button or hotkey to stop.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Microphone access was denied.');
    }
  }, [settings]);

  useEffect(
    () =>
      window.assistantApi.ui.onAction((action) => {
        if (action === 'capture') void openCapture();
        if (action === 'toggle-mic') void toggleMic();
      }),
    [openCapture, toggleMic]
  );

  useEffect(() => {
    function onEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      if (captureError) setCaptureError(null);
      else if (sources) {
        if (!captureBusy) setSources(null);
      } else if (isSettingsOpen) setSettingsOpen(false);
      else if (requestId.current) void window.assistantApi.chat.abort(requestId.current);
    }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [sources, captureBusy, captureError, isSettingsOpen]);

  function send(): void {
    if (requestId.current || (!input.trim() && attachments.length === 0)) return;
    if (!settings.hasApiKey) {
      setSettingsOpen(true);
      setStatus('Add your API key to start a conversation.');
      return;
    }
    const id = crypto.randomUUID();
    const userContent = input.trim() || 'Please review the attached context.';
    const requestMessages = assembleMessages(settings, messages, userContent, attachments);
    requestId.current = id;
    setMessages((previous) => [
      ...previous,
      { role: 'user', content: userContent },
      { role: 'assistant', content: '' }
    ]);
    setInput('');
    setAttachments([]);
    setStatus('Streaming response…');
    void window.assistantApi.chat
      .send({ requestId: id, messages: requestMessages })
      .catch((error: unknown) => {
        if (requestId.current !== id) return;
        requestId.current = null;
        setStatus(error instanceof Error ? error.message : 'Unable to send chat request.');
        setMessages((previous) =>
          previous.filter(
            (message, index) => index !== previous.length - 1 || message.content.length > 0
          )
        );
      });
  }

  async function selectSource(sourceId: string): Promise<void> {
    setCaptureBusy(true);
    try {
      const result = await window.assistantApi.capture.grabAndOcr(sourceId);
      if (!result.text) throw new Error('No readable text was found in that capture.');
      setAttachments((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          type: 'screen_text',
          text: result.text,
          imageWidth: result.imageWidth,
          imageHeight: result.imageHeight
        }
      ]);
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
  return (
    <main className="overlay-shell">
      <header className="titlebar">
        <div className="brand drag-region">
          <span className="brand-mark">
            <Icon name="spark" size={20} />
          </span>
          <span>
            Invizible
          </span>
        </div>
        <div className="window-actions">
          <button
            aria-label="Open settings"
            title="Settings"
            className="icon-button"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="settings" />
          </button>
          <button
            aria-label="Close application"
            title="Close application"
            className="icon-button close-button"
            onClick={() => void window.assistantApi.overlay.close()}
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="workspace-meta">
        <span className="protection-badge">
          <Icon name="shield" size={14} /> Hidden Overlay
        </span>
        <button className="model-button" title="Change model" onClick={() => setSettingsOpen(true)}>
          <span>{settings.model}</span>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <ChatView messages={messages} />
      <InputBar
        value={input}
        attachments={attachments}
        isStreaming={isStreaming}
        isRecording={isRecording}
        onChange={setInput}
        onSend={send}
        onAbort={() => requestId.current && void window.assistantApi.chat.abort(requestId.current)}
        onCapture={() => void openCapture()}
        onMic={() => void toggleMic()}
        onRemoveAttachment={(id) =>
          setAttachments((previous) => previous.filter((item) => item.id !== id))
        }
      />
      <footer>
        <span className="status-text" role="status" title={status}>
          <span className={`status-dot ${isStreaming || isRecording ? 'active' : ''}`} />
          {status}
        </span>
      </footer>
      {isSettingsOpen && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onTest={() => window.assistantApi.chat.test()}
        />
      )}
      {sources && (
        <SourcePicker
          sources={sources}
          busy={captureBusy}
          onSelect={(sourceId) => void selectSource(sourceId)}
          onClose={() => !captureBusy && setSources(null)}
        />
      )}
      {captureError && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="permission-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Screen Recording permission required"
          >
            <h2>Allow Screen Recording</h2>
            <p>
              {captureError.replace(/^Error invoking remote method 'capture:list-sources': /, '')}
            </p>
            <div className="settings-actions">
              <button className="secondary" onClick={() => setCaptureError(null)}>
                Cancel
              </button>
              <button className="secondary" onClick={() => void openCapture()}>
                Retry
              </button>
              <button onClick={() => void window.assistantApi.system.openScreenRecordingSettings()}>
                Open System Settings
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
