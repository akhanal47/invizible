import { type JSX, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
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
                void navigator.clipboard
                  .writeText(block.replace(/^\w+\n/, ''))
                  .then(() => setCopied(true));
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
  const list = useRef<HTMLElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (follow.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);
  if (messages.length === 0) {
    return (
      <section className="chat-empty-state">
        <div className="protected-mark">
          <Icon name="spark" size={34} />
        </div>
        <p>Ask a question, capture your screen, or talk it through.</p>
      </section>
    );
  }
  return (
    <section
      className="message-list"
      ref={list}
      aria-label="Conversation"
      aria-live="polite"
      onScroll={() => {
        const element = list.current;
        if (element)
          follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
    >
      {messages.map((message, index) => (
        <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
          <span className="message-label">{message.role === 'user' ? 'You' : 'Assistant'}</span>
          <div className="message-content">
            {message.content ? (
              <MessageContent content={message.content} />
            ) : (
              <span className="typing">Thinking…</span>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
