import { describe, expect, it } from 'vitest';
import { markStyle, markTone } from '../utils/mark-color';

describe('markTone (object colours)', () => {
  it('gives 40 objects 40 different colours, hues close only with another lightness', () => {
    const tones = Array.from({ length: 40 }, (_, i) => markTone(i));
    expect(new Set(tones.map((t) => `${t.hue}|${t.tier}`)).size).toBe(40);
    for (let i = 0; i < 20; i++) {
      for (let j = i + 1; j < 20; j++) {
        const gap = Math.abs(tones[i]!.hue - tones[j]!.hue);
        const hueGap = Math.min(gap, 360 - gap);
        if (hueGap < 15) expect(tones[i]!.tier).not.toBe(tones[j]!.tier);
      }
    }
  });

  it('is stable and safe for bad indexes; markStyle sets the CSS variables', () => {
    expect(markTone(3)).toEqual(markTone(3));
    expect(markTone(-1)).toEqual(markTone(0));
    expect(markStyle(1)).toEqual({ '--mark-h': '137.5', '--mark-dl': '-12%' });
  });
});
