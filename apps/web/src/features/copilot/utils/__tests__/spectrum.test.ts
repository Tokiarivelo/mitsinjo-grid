import { describe, it, expect } from 'vitest';
import {
  SPECTRUM_MAX_HZ,
  SPECTRUM_MIN_HZ,
  bandLevels,
  binWidthHz,
  freqToPosition,
  logBands,
  peakHz,
  splitHz,
} from '../spectrum';

const SAMPLE_RATE = 48_000;
const BIN_COUNT = 2048; // fftSize 4096 → 11.72 Hz per bin

/** Byte spectrum with one tone at `hz` (and lower neighbours, like a real window). */
function tone(hz: number, level = 220): Uint8Array {
  const bins = new Uint8Array(BIN_COUNT);
  const i = Math.round(hz / binWidthHz(SAMPLE_RATE, BIN_COUNT));
  bins[i - 1] = level - 60;
  bins[i] = level;
  bins[i + 1] = level - 60;
  return bins;
}

describe('voice spectrum', () => {
  it('spaces bands on a log axis from 80 Hz to 8 kHz', () => {
    const bands = logBands(40);
    expect(bands).toHaveLength(40);
    expect(bands[0]!.fromHz).toBeCloseTo(SPECTRUM_MIN_HZ);
    expect(bands.at(-1)!.toHz).toBeCloseTo(SPECTRUM_MAX_HZ);
    // Each band is the same ratio wide.
    expect(bands[1]!.toHz / bands[1]!.fromHz).toBeCloseTo(bands[30]!.toHz / bands[30]!.fromHz);
    expect(freqToPosition(800)).toBeCloseTo(0.5);
    expect(freqToPosition(20)).toBe(0);
    expect(freqToPosition(20_000)).toBe(1);
  });

  it('lights only the band that holds the tone', () => {
    const bands = logBands(40);
    const levels = bandLevels(tone(200), SAMPLE_RATE, bands);
    const lit = [...levels].flatMap((l, i) => (l > 0.8 ? [i] : []));
    expect(lit).toHaveLength(1);
    const band = bands[lit[0]!]!;
    expect(band.fromHz).toBeLessThanOrEqual(205);
    expect(band.toHz).toBeGreaterThanOrEqual(195);
  });

  it('gives low bands narrower than one bin a level (no gaps)', () => {
    const bins = new Uint8Array(BIN_COUNT).fill(100);
    const levels = bandLevels(bins, SAMPLE_RATE, logBands(60));
    expect([...levels].every((l) => l > 0)).toBe(true);
  });

  it('finds the peak frequency within one bin', () => {
    for (const hz of [120, 440, 3000]) {
      expect(Math.abs(peakHz(tone(hz), SAMPLE_RATE)! - hz)).toBeLessThan(
        binWidthHz(SAMPLE_RATE, BIN_COUNT)
      );
    }
  });

  it('reports silence as no peak', () => {
    expect(peakHz(new Uint8Array(BIN_COUNT).fill(10), SAMPLE_RATE)).toBeNull();
  });

  it('formats Hz under 1 kHz and kHz above', () => {
    expect(splitHz(212.4)).toEqual({ value: 212, unit: 'hz' });
    expect(splitHz(2468)).toEqual({ value: 2.5, unit: 'khz' });
  });
});
