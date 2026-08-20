import { describe, expect, it } from 'vitest';
import { elevenLabsUsesLanguageCode, normalizeElevenLabsCheapModel } from './audioCatalog';

describe('elevenLabsUsesLanguageCode', () => {
  it('returns true for Eleven V3 family', () => {
    expect(elevenLabsUsesLanguageCode('eleven_v3')).toBe(true);
    expect(elevenLabsUsesLanguageCode('eleven_turbo_v3')).toBe(true);
    expect(elevenLabsUsesLanguageCode('eleven_multilingual_v3')).toBe(true);
  });

  it('returns false for older Eleven models', () => {
    expect(elevenLabsUsesLanguageCode('eleven_multilingual_v2')).toBe(false);
    expect(elevenLabsUsesLanguageCode('eleven_flash_v2_5')).toBe(false);
    expect(elevenLabsUsesLanguageCode(normalizeElevenLabsCheapModel('eleven_turbo_v2_5'))).toBe(
      false,
    );
  });
});
