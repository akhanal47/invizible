import { type JSX, useState } from 'react';
import type { ChatMessage } from '../../shared/chat-types';

function MessageContent({ content }: { content: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const blocks = content.split(/```/);
  return (
    <>
      {blocks.map((block, index) =>
        index % 2 === 1 ? (
          <pre key={`${index}-${block.slice(0, 12)}`}>
            <button
              className="copy-button"
              onClick={() => {
                void navigator.clipboard.writeText(block.replace(/^\w+\n/, '')).then(() => setCopied(true));
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <code>{block.replace(/^\w+\n/, '')}</code>
          </pre>
        ) : (
          <span key={`${index}-${block.slice(0, 12)}`} className="message-text">
            {block}
          </span>
        )
      )}
    </>
  );
}

export function ChatView({ messages }: { messages: ChatMessage[] }): JSX.Element {
  if (messages.length === 0) {
    return (
      <section className="chat-empty-state">
        <div className="protected-mark">◈</div>
        <h1>Your private AI overlay</h1>
        <p>Capture a window, dictate a note, or type a prompt. Nothing is sent until you press Enter.</p>
      </section>
    );
  }
  return (
    <section className="message-list" aria-live="polite">
      {messages.map((message, index) => (
        <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
          <span className="message-label">{message.role === 'user' ? 'You' : 'Assistant'}</span>
          <div className="message-content">
            {message.content ? <MessageContent content={message.content} /> : <span className="typing">Thinking…</span>}
          </div>
        </article>
      ))}
    </section>
  );
}
