import { describe, expect, it } from 'vitest';
import { bestVoice, voiceGender, voiceQuality, type JaVoice } from './speech';

const v = (id: string, name: string, index = 0): JaVoice => ({ id, name, index, quality: voiceQuality(id, name), gender: voiceGender(id, name) });

describe('読み上げの声', () => {
  it('iPhone の声のIDから音質と性別がわかる', () => {
    expect(voiceQuality('com.apple.voice.compact.ja-JP.Kyoko')).toBe('standard');
    expect(voiceQuality('com.apple.voice.enhanced.ja-JP.Kyoko')).toBe('enhanced');
    expect(voiceQuality('com.apple.voice.premium.ja-JP.Kyoko')).toBe('premium');
    expect(voiceGender('com.apple.voice.compact.ja-JP.Kyoko', 'Kyoko')).toBe('female');
    expect(voiceGender('com.apple.voice.compact.ja-JP.Otoya', 'Otoya')).toBe('male');
    expect(voiceGender('x', 'Female voice')).toBe('female');
  });

  it('自動では高音質を優先し、同じ音質なら女性の声を選ぶ', () => {
    const list = [
      v('com.apple.voice.compact.ja-JP.Otoya', 'Otoya', 0),
      v('com.apple.voice.compact.ja-JP.Kyoko', 'Kyoko', 1),
      v('com.apple.voice.enhanced.ja-JP.Otoya', 'Otoya', 2),
    ];
    expect(bestVoice(list)?.index).toBe(2);
    expect(bestVoice(list.slice(0, 2))?.name).toBe('Kyoko');
    expect(bestVoice([])).toBeUndefined();
  });
});
