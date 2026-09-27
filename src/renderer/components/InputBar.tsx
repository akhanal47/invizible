import { type ChangeEvent, type JSX, type KeyboardEvent } from 'react';
import { Icon } from './Icon';
import type { PendingAttachment } from '../../shared/chat-types';

import type { VoicePhase } from '../lib/useVoiceInput';

interface InputBarProps {
  value: string;
  attachments: PendingAttachment[];
  isStreaming: boolean;
  voicePhase: VoicePhase;
  interimTranscript: string;
  liveVoice: boolean;
  onChange(value: string): void;
  onSend(): void;
  onAbort(): void;
  onCapture(): void;
  onMic(): void;
  onRemoveAttachment(id: string): void;
}

export function InputBar(props: InputBarProps): JSX.Element {
  const isRecording = props.voicePhase === 'listening';
  const voiceBusy = props.voicePhase !== 'idle';
  const micLabel =
    props.voicePhase === 'connecting'
      ? 'Cancel'
      : props.voicePhase === 'finishing'
        ? 'Finishing…'
        : isRecording
          ? 'Stop'
          : props.liveVoice
            ? 'Live dictate'
            : 'Dictate';
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!voiceBusy) props.onSend();
    }
  }
  return (
    <section className="input-area">
      {props.attachments.length > 0 && (
        <div className="attachment-list">
          {props.attachments.map((attachment) => (
            <span className="attachment-chip" key={attachment.id}>
              <Icon name={attachment.type === 'screen_text' ? 'capture' : 'mic'} size={16} />
              <span title={attachment.text}>
                {attachment.type === 'screen_text' ? 'Screen text' : 'Transcript'} ·{' '}
                {attachment.text.slice(0, 48)}
              </span>
              <button
                aria-label="Remove attachment"
                onClick={() => props.onRemoveAttachment(attachment.id)}
              >
                <Icon name="close" size={16} />
              </button>
            </span>
          ))}
        </div>
      )}
      {props.interimTranscript && (
        <div className="live-transcript" aria-label="Tentative transcript">
          {props.interimTranscript}
          <span> …</span>
        </div>
      )}
      <textarea
        aria-label="Message"
        placeholder="Ask anything, or add some context…"
        rows={2}
        value={props.value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => props.onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="input-actions">
        <div className="tool-actions">
          <button
            className="tool-button"
            aria-label="Capture screen or window"
            title="Capture screen or window"
            onClick={props.onCapture}
          >
            <Icon name="capture" />
            <span>Capture</span>
          </button>
          <button
            className={`tool-button ${isRecording ? 'recording' : ''}`}
            aria-label={micLabel}
            aria-pressed={isRecording}
            title={micLabel}
            disabled={props.voicePhase === 'finishing'}
            onClick={props.onMic}
          >
            <Icon name={isRecording ? 'stop' : 'mic'} />
            <span>{micLabel}</span>
          </button>
        </div>
        {props.isStreaming ? (
          <button
            className="send-button stopping"
            aria-label="Stop response"
            title="Stop response (Esc)"
            onClick={props.onAbort}
          >
            <Icon name="stop" />
          </button>
        ) : (
          <button
            className="send-button"
            aria-label="Send message"
            title="Send message (Enter)"
            onClick={props.onSend}
            disabled={voiceBusy || (!props.value.trim() && props.attachments.length === 0)}
          >
            <Icon name="send" />
          </button>
        )}
      </div>
    </section>
  );
}
