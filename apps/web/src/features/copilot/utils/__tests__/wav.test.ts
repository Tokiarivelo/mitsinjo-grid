import { describe, it, expect } from 'vitest';
import { encodeWav, VOICE_SAMPLE_RATE } from '../wav';

describe('encodeWav', () => {
  it('writes a 16 kHz mono 16-bit PCM header and clamped samples', () => {
    const buf = encodeWav(new Float32Array([0, 1, -1, 2]));
    const view = new DataView(buf);
    const text = (o: number, n: number) =>
      String.fromCharCode(...new Uint8Array(buf.slice(o, o + n)));
    expect(buf.byteLength).toBe(44 + 4 * 2);
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(VOICE_SAMPLE_RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([
      0, 32767, -32768, 32767,
    ]);
  });
});
