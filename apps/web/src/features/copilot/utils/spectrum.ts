/**
 * Voice spectrum helpers for the microphone display. Input is an `AnalyserNode` byte spectrum
 * (`getByteFrequencyData`): `bins.length = fftSize / 2`, bin `i` centred on `i * sampleRate / fftSize` Hz.
 */

/** Lowest and highest frequencies shown: male voice pitch (≈ 85 Hz) up to the sibilants (≈ 8 kHz). */
export const SPECTRUM_MIN_HZ = 80;
export const SPECTRUM_MAX_HZ = 8000;
/** Usual range of the voice's fundamental (pitch), adult speech. */
export const VOICE_PITCH_HZ = { from: 85, to: 255 } as const;
/** Byte level (0–255) under which the microphone is treated as silent. */
export const SILENCE_LEVEL = 40;

export interface SpectrumBand {
  fromHz: number;
  toHz: number;
}

/** Hz width of one analyser bin. */
export function binWidthHz(sampleRate: number, binCount: number): number {
  return sampleRate / (2 * binCount);
}

/** Position of `hz` on a log axis from `minHz` (0) to `maxHz` (1), clamped. */
export function freqToPosition(
  hz: number,
  minHz = SPECTRUM_MIN_HZ,
  maxHz = SPECTRUM_MAX_HZ
): number {
  const p = Math.log(hz / minHz) / Math.log(maxHz / minHz);
  return Math.min(1, Math.max(0, p));
}

/** `count` bands of equal width on a log axis (the ear hears pitch logarithmically). */
export function logBands(
  count: number,
  minHz = SPECTRUM_MIN_HZ,
  maxHz = SPECTRUM_MAX_HZ
): SpectrumBand[] {
  const ratio = Math.pow(maxHz / minHz, 1 / count);
  return Array.from({ length: count }, (_, i) => ({
    fromHz: minHz * Math.pow(ratio, i),
    toHz: minHz * Math.pow(ratio, i + 1),
  }));
}

/**
 * Level 0–1 of each band: the loudest bin whose centre frequency is inside it (each bin counts
 * once). A band narrower than one bin uses the bin nearest its centre, so low bands never read empty.
 */
export function bandLevels(
  bins: ArrayLike<number>,
  sampleRate: number,
  bands: SpectrumBand[],
  out: Float32Array = new Float32Array(bands.length)
): Float32Array {
  const width = binWidthHz(sampleRate, bins.length);
  const last = bins.length - 1;
  bands.forEach((band, b) => {
    let first = Math.ceil(band.fromHz / width);
    let end = Math.min(last, Math.ceil(band.toHz / width) - 1);
    if (end < first)
      first = end = Math.min(last, Math.round(Math.sqrt(band.fromHz * band.toHz) / width));
    let max = 0;
    for (let i = first; i <= end; i++) max = Math.max(max, bins[i] ?? 0);
    out[b] = max / 255;
  });
  return out;
}

/**
 * Frequency (Hz) of the loudest bin between `minHz` and `maxHz`, refined between neighbour bins
 * (parabolic fit); `null` when everything is under `SILENCE_LEVEL`.
 */
export function peakHz(
  bins: ArrayLike<number>,
  sampleRate: number,
  minHz = SPECTRUM_MIN_HZ,
  maxHz = SPECTRUM_MAX_HZ
): number | null {
  const width = binWidthHz(sampleRate, bins.length);
  const first = Math.max(1, Math.ceil(minHz / width));
  const end = Math.min(bins.length - 2, Math.floor(maxHz / width));
  let best = -1;
  let bestLevel = SILENCE_LEVEL;
  for (let i = first; i <= end; i++) {
    const level = bins[i] ?? 0;
    if (level > bestLevel) {
      best = i;
      bestLevel = level;
    }
  }
  if (best < 0) return null;
  const left = bins[best - 1] ?? 0;
  const right = bins[best + 1] ?? 0;
  const curve = left - 2 * bestLevel + right;
  const shift = curve === 0 ? 0 : (0.5 * (left - right)) / curve;
  return (best + shift) * width;
}

/** Hz below 1 kHz (whole number), kHz above (one decimal), for the axis and the peak readout. */
export function splitHz(hz: number): { value: number; unit: 'hz' | 'khz' } {
  return hz < 1000
    ? { value: Math.round(hz), unit: 'hz' }
    : { value: Math.round(hz / 100) / 10, unit: 'khz' };
}
