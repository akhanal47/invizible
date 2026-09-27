import WebSocket from 'ws';
import type { LiveTranscriptionEvent } from '../shared/ipc-contract';

/** One ordered WebM/Opus stream. Secrets and the provider socket stay in main. */
export class LiveTranscription {
  private socket: WebSocket | null = null;
  private stopping = false;
  private ended = false;
  private keepAlive?: ReturnType<typeof setInterval>;
  private stopTimer?: ReturnType<typeof setTimeout>;
  private rejectStart?: (error: Error) => void;
  private finalEnd = -1;

  constructor(
    private readonly emit: (event: LiveTranscriptionEvent) => void,
    readonly sessionId: string
  ) {}

  start(key: string, model: string, language: string): Promise<void> {
    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.search = new URLSearchParams({
      model,
      language,
      interim_results: 'true',
      smart_format: 'true',
      endpointing: '300'
    }).toString();
    return new Promise((resolve, reject) => {
      this.rejectStart = reject;
      const socket = (this.socket = new WebSocket(url, {
        headers: { Authorization: `Token ${key}` },
        handshakeTimeout: 12_000,
        maxPayload: 1024 * 1024
      }));
      socket.on('open', () => {
        if (this.ended) return;
        this.rejectStart = undefined;
        this.keepAlive = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN && !this.stopping)
            socket.send(JSON.stringify({ type: 'KeepAlive' }));
        }, 4000);
        resolve();
      });
      socket.on('message', (data) => {
        if (this.ended) return;
        try {
          const payload = JSON.parse(data.toString()) as {
            type?: string;
            is_final?: boolean;
            start?: number;
            duration?: number;
            channel?: { alternatives?: Array<{ transcript?: string }> };
          };
          if (payload.type === 'Error')
            return this.fail(
              'The transcription provider rejected the stream. Check your model and language settings.'
            );
          if (payload.type !== 'Results') return;
          const text = payload.channel?.alternatives?.[0]?.transcript;
          if (typeof text !== 'string') return;
          const final = payload.is_final === true;
          // A repeated final segment must never insert the same words twice.
          const end = (payload.start ?? 0) + (payload.duration ?? 0);
          if (final) {
            if (end <= this.finalEnd) return;
            this.finalEnd = end;
          }
          this.emit({ sessionId: this.sessionId, type: 'transcript', text, final });
        } catch {
          this.fail('The transcription provider returned an unreadable response.');
        }
      });
      socket.on('error', () =>
        this.fail(
          'Live transcription could not connect or was interrupted. Check your Deepgram key and network connection.'
        )
      );
      socket.on('close', (code) => {
        if (this.ended) return;
        if (this.stopping && code === 1000) this.finish();
        else
          this.fail(
            'Live transcription disconnected. Finalized text has been kept; start the microphone again to continue.'
          );
      });
    });
  }

  send(audio: ArrayBuffer): Promise<void> {
    const socket = this.socket;
    if (this.ended || this.stopping || !socket || socket.readyState !== WebSocket.OPEN)
      return Promise.reject(new Error('The transcription stream is not connected.'));
    if (
      !(audio instanceof ArrayBuffer) ||
      audio.byteLength > 1024 * 1024 ||
      socket.bufferedAmount > 1024 * 1024
    ) {
      this.fail('The audio connection is too slow. Please restart dictation.');
      return Promise.reject(new Error('Audio buffer limit exceeded.'));
    }
    if (!audio.byteLength) return Promise.resolve();
    return new Promise((resolve, reject) => {
      socket.send(Buffer.from(audio), (error) => {
        if (error) {
          this.fail('Unable to send microphone audio.');
          reject(error);
        } else resolve();
      });
    });
  }

  stop(): void {
    if (this.ended || this.stopping) return;
    if (this.socket?.readyState !== WebSocket.OPEN) return this.cancel();
    this.stopping = true;
    clearInterval(this.keepAlive);
    this.stopTimer = setTimeout(
      () => this.fail('Timed out finishing the transcript. Finalized text has been kept.'),
      10_000
    );
    // Deepgram flushes final Results before closing the socket.
    this.socket.send(JSON.stringify({ type: 'CloseStream' }));
  }

  cancel(): void {
    this.finish();
  }

  private fail(message: string): void {
    this.finish(message);
  }

  private finish(message?: string): void {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.keepAlive);
    clearTimeout(this.stopTimer);
    this.rejectStart?.(new Error(message ?? 'Transcription cancelled.'));
    this.rejectStart = undefined;
    this.socket?.terminate();
    this.emit(
      message
        ? { sessionId: this.sessionId, type: 'error', message }
        : { sessionId: this.sessionId, type: 'done' }
    );
  }
}
