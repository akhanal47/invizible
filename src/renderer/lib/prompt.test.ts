import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { assembleMessages } from './prompt';

describe('assembleMessages', () => {
  it('inserts OCR text in the base prompt template', () => {
    const messages = assembleMessages(
      { ...DEFAULT_SETTINGS, baseUserPrompt: 'Review: {{screen_text}}' },
      [],
      'What is wrong?',
      [{ id: '1', type: 'screen_text', text: 'const broken = true' }]
    );
    expect(messages.at(-1)?.content).toContain('Review: const broken = true');
  });
});
