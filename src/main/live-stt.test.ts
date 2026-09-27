import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ sockets: [] as unknown[] }));
vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  class Socket extends EventEmitter {
    static OPEN = 1;
    readyState = 0;
    bufferedAmount = 0;
    sent: unknown[] = [];
    terminate = vi.fn();
    constructor(
      readonly url: URL,
      readonly options: unknown
    ) {
      super();
      state.sockets.push(this);
    }
    send(data: unknown, callback?: (error?: Error) => void) {
      this.sent.push(data);
      callback?.();
    }
  }
  return { default: Socket };
});
import WebSocket from 'ws';
import { LiveTranscription } from './live-stt';
import type { LiveTranscriptionEvent } from '../shared/ipc-contract';
type MockSocket = EventEmitter & {
  readyState: number;
  bufferedAmount: number;
  sent: unknown[];
  url: URL;
  options: unknown;
  terminate: ReturnType<typeof vi.fn>;
};
const sessions: LiveTranscription[] = [];
afterEach(() => {
  sessions.forEach((s) => s.cancel());
  sessions.length = 0;
  state.sockets.length = 0;
  vi.useRealTimers();
});
async function connected() {
  const events: LiveTranscriptionEvent[] = [];
  const session = new LiveTranscription((event) => events.push(event), 'one');
  sessions.push(session);
  const start = session.start('secret', 'nova-3', 'en');
  const socket = state.sockets.at(-1) as MockSocket;
  socket.readyState = WebSocket.OPEN;
  socket.emit('open');
  await start;
  return { session, socket, events };
}
function result(socket: MockSocket, text: string, final: boolean, start = 0, duration = 1) {
  socket.emit(
    'message',
    Buffer.from(
      JSON.stringify({
        type: 'Results',
        is_final: final,
        start,
        duration,
        channel: { alternatives: [{ transcript: text }] }
      })
    )
  );
}
describe('cloud live transcription', () => {
  it('authenticates in main and sends audio without encoding parameters for container audio', async () => {
    const { session, socket } = await connected();
    expect(socket.options).toMatchObject({ headers: { Authorization: 'Token secret' } });
    expect(socket.url.searchParams.get('interim_results')).toBe('true');
    expect(socket.url.searchParams.has('encoding')).toBe(false);
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    await session.send(bytes);
    expect(socket.sent[0]).toEqual(Buffer.from(bytes));
  });
  it('replaces tentative results, deduplicates finals and waits for the last words on stop', async () => {
    const { session, socket, events } = await connected();
    result(socket, 'hel', false);
    result(socket, 'hello', false);
    result(socket, 'Hello.', true);
    result(socket, 'Hello.', true);
    session.stop();
    expect(socket.sent.at(-1)).toBe('{"type":"CloseStream"}');
    expect(events.some((e) => e.type === 'done')).toBe(false);
    result(socket, 'Last words.', true, 1, 1);
    socket.emit('close', 1000);
    expect(
      events
        .filter((e) => e.type === 'transcript' && e.final)
        .map((e) => e.type === 'transcript' && e.text)
    ).toEqual(['Hello.', 'Last words.']);
    expect(events.at(-1)).toEqual({ sessionId: 'one', type: 'done' });
  });
  it('reports an interrupted connection once and releases its socket', async () => {
    const { session, socket, events } = await connected();
    socket.emit('error', new Error('private provider internals'));
    socket.emit('close', 1006);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'error' });
    expect(socket.terminate).toHaveBeenCalledOnce();
    await expect(session.send(new ArrayBuffer(1))).rejects.toThrow('not connected');
  });
  it('rejects connection failures without leaving a pending start', async () => {
    const events: LiveTranscriptionEvent[] = [];
    const session = new LiveTranscription((e) => events.push(e), 'two');
    sessions.push(session);
    const start = session.start('invalid', 'nova-3', 'en');
    const assertion = expect(start).rejects.toThrow('Deepgram key');
    (state.sockets.at(-1) as MockSocket).emit('error', new Error('401'));
    await assertion;
    expect(events[0]).toMatchObject({ type: 'error' });
  });
  it('bounds stop waiting and stops keepalives after completion', async () => {
    vi.useFakeTimers();
    const { session, socket, events } = await connected();
    vi.advanceTimersByTime(4000);
    expect(socket.sent).toContain('{"type":"KeepAlive"}');
    session.stop();
    vi.advanceTimersByTime(10_000);
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      message: expect.stringContaining('Timed out')
    });
    const count = socket.sent.length;
    vi.advanceTimersByTime(20_000);
    expect(socket.sent).toHaveLength(count);
  });
  it('fails rather than allowing an unbounded audio backlog', async () => {
    const { session, socket, events } = await connected();
    socket.bufferedAmount = 2 * 1024 * 1024;
    await expect(session.send(new ArrayBuffer(100))).rejects.toThrow('buffer limit');
    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });
});
