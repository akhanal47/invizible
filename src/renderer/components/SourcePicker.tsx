import { type JSX } from 'react';
import type { CaptureSource } from '../../shared/ipc-contract';

interface SourcePickerProps {
  sources: CaptureSource[];
  busy: boolean;
  onSelect(sourceId: string): void;
  onClose(): void;
}

export function SourcePicker({ sources, busy, onSelect, onClose }: SourcePickerProps): JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="source-picker" role="dialog" aria-modal="true" aria-label="Choose a source for OCR">
        <div className="settings-heading">
          <div><h2>Capture for OCR</h2><p>Choose a display or window. Text is attached to your next message.</p></div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="source-grid">
          {sources.map((source) => (
            <button className="source-card" disabled={busy} key={source.id} onClick={() => onSelect(source.id)}>
              {source.thumbnailDataUrl ? <img src={source.thumbnailDataUrl} alt="" /> : <div className="empty-thumbnail">No preview</div>}
              <span>{source.kind === 'screen' ? 'Display' : 'Window'} · {source.name}</span>
            </button>
          ))}
        </div>
        {busy && <p className="busy-note">Recognizing text…</p>}
      </section>
    </div>
  );
}
