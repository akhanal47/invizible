import { type ChangeEvent, type JSX, type KeyboardEvent } from 'react';
import type { PendingAttachment } from '../../shared/chat-types';

interface InputBarProps {
  value: string;
  attachments: PendingAttachment[];
  isStreaming: boolean;
  isRecording: boolean;
  onChange(value: string): void;
  onSend(): void;
  onAbort(): void;
  onCapture(): void;
  onMic(): void;
  onRemoveAttachment(id: string): void;
}

export function InputBar(props: InputBarProps): JSX.Element {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      props.onSend();
    }
  }
  return (
    <section className="input-area">
      {props.attachments.length > 0 && (
        <div className="attachment-list">
          {props.attachments.map((attachment) => (
            <span className="attachment-chip" key={attachment.id}>
              {attachment.type === 'screen_text' ? 'Screen OCR' : 'Transcript'} · {attachment.text.slice(0, 48)}
              <button aria-label="Remove attachment" onClick={() => props.onRemoveAttachment(attachment.id)}>×</button>
            </span>
          ))}
        </div>
      )}
      <textarea
        aria-label="Message"
        placeholder="Type a prompt…"
        rows={3}
        value={props.value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => props.onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="input-actions">
        <div className="tool-actions">
          <button className="tool-button" aria-label="Capture screen or window" onClick={props.onCapture}>▣ Capture</button>
          <button className={`tool-button ${props.isRecording ? 'recording' : ''}`} aria-label="Toggle microphone" onClick={props.onMic}>
            {props.isRecording ? '■ Stop mic' : '● Mic'}
          </button>
        </div>
        {props.isStreaming ? (
          <button className="secondary" onClick={props.onAbort}>Stop</button>
        ) : (
          <button onClick={props.onSend} disabled={!props.value.trim() && props.attachments.length === 0}>Send</button>
        )}
      </div>
    </section>
  );
}
