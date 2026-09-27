import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsView } from '../../shared/settings';
import { supportsTranscription } from '../../shared/providers';

export type VoicePhase = 'idle' | 'connecting' | 'listening' | 'finishing';

export function useVoiceInput(
  settings: SettingsView,
  insert: (text: string, sessionId: string) => void,
  status: (text: string) => void,
  openSettings: () => void
) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [interim, setInterim] = useState('');
  const active = useRef<{
    id: string;
    live: boolean;
    phase: VoicePhase;
    recorder?: MediaRecorder;
    stream?: MediaStream;
    chunks: Blob[];
    queue: Promise<void>;
    pendingBytes: number;
  } | null>(null);
  const callbacks = useRef({ insert, status, openSettings });
  callbacks.current = { insert, status, openSettings };

  const cleanup = useCallback(() => {
    const current = active.current;
    active.current = null;
    if (current?.recorder && current.recorder.state !== 'inactive') current.recorder.stop();
    current?.stream?.getTracks().forEach((track) => track.stop());
    setPhase('idle');
    setInterim('');
    return current;
  }, []);

  useEffect(() => {
    const unsubscribe = window.assistantApi.stt.onStream((event) => {
      if (active.current?.id !== event.sessionId) return;
      if (event.type === 'transcript') {
        if (event.final) {
          setInterim('');
          if (event.text.trim()) callbacks.current.insert(event.text.trim(), event.sessionId);
        } else setInterim(event.text);
      } else {
        cleanup();
        callbacks.current.status(
          event.type === 'error'
            ? event.message
            : 'Dictation finished. Review your text, then send.'
        );
      }
    });
    return () => {
      unsubscribe();
      const current = cleanup();
      if (current?.live) void window.assistantApi.stt.cancel(current.id).catch(() => undefined);
    };
  }, [cleanup]);

  const toggle = useCallback(async () => {
    const previous = active.current;
    if (previous) {
      if (previous.phase === 'listening') {
        previous.phase = 'finishing';
        setPhase('finishing');
        callbacks.current.status('Finishing transcription…');
        previous.recorder?.stop();
        previous.stream?.getTracks().forEach((track) => track.stop());
      } else if (previous.phase === 'connecting') {
        cleanup();
        if (previous.live) void window.assistantApi.stt.cancel(previous.id).catch(() => undefined);
        callbacks.current.status('Dictation cancelled.');
      }
      return;
    }
    const live = settings.sttProvider === 'deepgram';
    const voiceUrl = settings.sttBaseUrl ?? settings.baseUrl;
    const sameEndpoint = voiceUrl.replace(/\/+$/, '') === settings.baseUrl.replace(/\/+$/, '');
    const configured = live
      ? settings.hasSttApiKey
      : supportsTranscription(voiceUrl) &&
        (settings.hasSttApiKey || (sameEndpoint && settings.hasApiKey));
    if (!configured) {
      callbacks.current.status(
        'Choose a voice provider and add its API key in Settings → Voice input.'
      );
      callbacks.current.openSettings();
      return;
    }
    const current: NonNullable<typeof active.current> = {
      id: crypto.randomUUID(),
      live,
      phase: 'connecting',
      chunks: [],
      queue: Promise.resolve(),
      pendingBytes: 0
    };
    active.current = current;
    setPhase('connecting');
    setInterim('');
    callbacks.current.status('Connecting microphone…');
    const fail = (error: unknown): void => {
      if (active.current !== current) return;
      cleanup();
      if (live) void window.assistantApi.stt.cancel(current.id).catch(() => undefined);
      callbacks.current.status(error instanceof Error ? error.message : 'Dictation failed.');
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (active.current !== current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.stream = stream;
      if (live) await window.assistantApi.stt.start(current.id);
      if (active.current !== current) return;
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
        throw new Error('This device cannot record WebM/Opus audio.');
      const recorder = (current.recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64_000
      }));
      recorder.ondataavailable = (event) => {
        if (active.current !== current || !event.data.size) return;
        if (!live) {
          current.chunks.push(event.data);
          return;
        }
        current.pendingBytes += event.data.size;
        if (current.pendingBytes > 1024 * 1024)
          return fail(new Error('The audio connection is too slow. Restart dictation.'));
        // Keep container fragments in order and send the last fragment before CloseStream.
        current.queue = current.queue
          .then(async () => {
            if (active.current !== current) return;
            const audio = await event.data.arrayBuffer();
            if (active.current !== current) return;
            await window.assistantApi.stt.audio(current.id, audio);
            current.pendingBytes -= event.data.size;
          })
          .catch(fail);
      };
      recorder.onerror = () =>
        fail(new Error('Microphone recording failed. Please restart dictation.'));
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (active.current !== current) return;
        current.phase = 'finishing';
        setPhase('finishing');
        if (live) {
          void current.queue
            .then(() => {
              if (active.current === current) return window.assistantApi.stt.stop(current.id);
            })
            .catch(fail);
        } else {
          const audio = new Blob(current.chunks, { type: recorder.mimeType });
          void audio
            .arrayBuffer()
            .then((buffer) =>
              window.assistantApi.stt.transcribe({ audio: buffer, mimeType: audio.type })
            )
            .then((text) => {
              if (active.current !== current) return;
              cleanup();
              if (text) callbacks.current.insert(text, current.id);
              callbacks.current.status(
                text
                  ? 'Transcript inserted. Review your text, then send.'
                  : 'No speech was detected.'
              );
            })
            .catch(fail);
        }
      };
      stream.getAudioTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (active.current === current && current.phase === 'listening')
            fail(new Error('The microphone was disconnected. Finalized text has been kept.'));
        })
      );
      recorder.start(live ? 250 : undefined);
      current.phase = 'listening';
      setPhase('listening');
      callbacks.current.status(
        live
          ? 'Live dictation · audio is sent to Deepgram. Click Stop when finished.'
          : 'Recording… click Stop to transcribe.'
      );
    } catch (error) {
      fail(error);
    }
  }, [settings, cleanup]);

  return { phase, interim, toggle };
}
