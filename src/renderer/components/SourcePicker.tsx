import { type JSX } from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';
import type { CaptureSource } from '../../shared/ipc-contract';

interface SourcePickerProps {
  sources: CaptureSource[];
  busy: boolean;
  onSelect(sourceId: string): void;
  onClose(): void;
}

export function SourcePicker({ sources, busy, onSelect, onClose }: SourcePickerProps): JSX.Element {
  return (
    <Modal label="Choose screen context" onClose={onClose}>
      <section className="source-picker">
        <div className="settings-heading">
          <div>
            <h2>Add screen context</h2>
            <p>Choose a display or window. Text is attached to your next message.</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close source picker"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {sources.length === 0 && (
          <p className="busy-note">
            No screens or windows are available. Check screen recording permissions and try again.
          </p>
        )}
        <div className="source-grid">
          {sources.map((source) => (
            <button
              className="source-card"
              disabled={busy}
              key={source.id}
              onClick={() => onSelect(source.id)}
            >
              {source.thumbnailDataUrl ? (
                <img src={source.thumbnailDataUrl} alt="" />
              ) : (
                <div className="empty-thumbnail">No preview</div>
              )}
              <span>
                {source.kind === 'screen' ? 'Display' : 'Window'} · {source.name}
              </span>
            </button>
          ))}
        </div>
        {busy && <p className="busy-note">Recognizing text…</p>}
      </section>
    </Modal>
  );
}
