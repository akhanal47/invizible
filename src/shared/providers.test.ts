import { describe, expect, it } from 'vitest';
import { isLocalEndpoint, providerForUrl, supportsTranscription } from './providers';

describe('local providers', () => {
  it.each(['http://localhost:11434/v1', 'http://127.0.0.1:8080/v1', 'http://[::1]:8080/v1'])(
    'allows keyless loopback %s',
    (url) => {
      expect(isLocalEndpoint(url)).toBe(true);
      expect(supportsTranscription(url)).toBe(false);
    }
  );
  it.each(['http://localhost.example.com/v1', 'https://example.com', 'file:///tmp', 'invalid'])(
    'does not treat %s as loopback',
    (url) => expect(isLocalEndpoint(url)).toBe(false)
  );
  it('recognizes local presets', () => {
    expect(providerForUrl('http://localhost:11434/v1/')).toBe('ollama');
    expect(providerForUrl('http://localhost:8080/v1')).toBe('llamacpp');
  });
});
