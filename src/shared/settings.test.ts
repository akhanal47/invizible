import { describe, expect, it } from 'vitest';
import { validateSettingsUpdate } from './settings';

describe('validateSettingsUpdate', () => {
  it('accepts valid partial updates', () => {
    expect(validateSettingsUpdate({ baseUrl: 'https://example.com/v1', maxOutputTokens: 16 })).toEqual([]);
  });

  it('rejects invalid values', () => {
    expect(validateSettingsUpdate({ baseUrl: 'not-a-url', contextBudgetTokens: 0 })).toEqual([
      'Base URL must be a valid URL.',
      'Context budget must be a positive integer.'
    ]);
  });
});
