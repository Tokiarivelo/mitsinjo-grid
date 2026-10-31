'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { fmtNum } from '@/lib/format';
import {
  VOICE_PITCH_HZ,
  bandLevels,
  freqToPosition,
  logBands,
  peakHz,
  splitHz,
} from '../utils/spectrum';

/** Bars on the log frequency axis (80 Hz → 8 kHz). */
const BAND_COUNT = 48;
/** Axis labels; the ones in `NARROW_HIDDEN` are dropped on phones. */
const TICKS_HZ = [100, 250, 500, 1000, 2000, 4000, 8000] as const;
const NARROW_HIDDEN = new Set<number>([250, 2000]);
/** Refresh of the peak readout (bars move every frame, the number would be unreadable). */
const PEAK_TEXT_MS = 150;
/** Bars never drop to zero height, so the axis stays visible in silence. */
const MIN_BAR = 0.03;

export interface VoiceSpectrumProps {
  /** Live microphone analyser from `useVoiceInput`. */
  analyser: AnalyserNode;
  className?: string;
}

/**
 * Live frequency spectrum of the microphone while recording: each bar is one band of the
 * analyser's FFT on a log axis, the cyan line marks the loudest frequency.
 * The DOM is updated through refs each frame (no React re-render).
 */
export function VoiceSpectrum({ analyser, className }: VoiceSpectrumProps) {
  const t = useTranslations('features.copilot.voice');
  const bands = useMemo(() => logBands(BAND_COUNT), []);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const peakLineRef = useRef<HTMLDivElement>(null);
  const peakTextRef = useRef<HTMLSpanElement>(null);

  const hzLabel = useMemo(
    () => (hz: number) => {
      const { value, unit } = splitHz(hz);
      return t(unit, { value: fmtNum(value, unit === 'hz' ? 0 : 1).replace(/\.0$/, '') });
    },
    [t]
  );

  useEffect(() => {
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const levels = new Float32Array(bands.length);
    const sampleRate = analyser.context.sampleRate;
    let frame = 0;
    let lastText = 0;

    const draw = (now: number) => {
      analyser.getByteFrequencyData(bins);
      bandLevels(bins, sampleRate, bands, levels);
      barRefs.current.forEach((bar, i) => {
        if (bar) bar.style.transform = `scaleY(${Math.max(MIN_BAR, levels[i] ?? 0)})`;
      });
      const peak = peakHz(bins, sampleRate);
      const line = peakLineRef.current;
      if (line) {
        line.style.opacity = peak === null ? '0' : '1';
        if (peak !== null) line.style.left = `${freqToPosition(peak) * 100}%`;
      }
      if (peakTextRef.current && now - lastText > PEAK_TEXT_MS) {
        lastText = now;
        peakTextRef.current.textContent =
          peak === null ? t('peakNone') : t('peak', { freq: hzLabel(peak) });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser, bands, hzLabel, t]);

  const pitchLeft = freqToPosition(VOICE_PITCH_HZ.from) * 100;
  const pitchWidth = freqToPosition(VOICE_PITCH_HZ.to) * 100 - pitchLeft;

  return (
    <div
      role="img"
      aria-label={t('spectrumAria')}
      className={cn('rounded-md border border-ai-violet/30 bg-surface px-2.5 pt-2 pb-1', className)}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
        <span className="uppercase tracking-wide text-ai-violet">{t('spectrumTitle')}</span>
        <span ref={peakTextRef} aria-hidden="true" className="tabular-nums text-text-primary">
          {t('peakNone')}
        </span>
      </div>

      <div className="relative mt-1.5 h-14" aria-hidden="true">
        <div
          className="absolute inset-y-0 rounded-sm bg-ai-violet/10"
          style={{ left: `${pitchLeft}%`, width: `${pitchWidth}%` }}
        />
        <span
          className="absolute top-0 px-0.5 text-[9px] leading-none text-text-muted"
          style={{ left: `${pitchLeft}%` }}
        >
          {t('pitchZone')}
        </span>
        <div className="absolute inset-0 flex items-end gap-px">
          {bands.map((band, i) => (
            <div
              key={band.fromHz}
              ref={(el) => {
                barRefs.current[i] = el;
              }}
              className="h-full flex-1 origin-bottom rounded-t-sm bg-ai-violet will-change-transform"
              style={{ transform: `scaleY(${MIN_BAR})` }}
            />
          ))}
        </div>
        <div
          ref={peakLineRef}
          className="absolute inset-y-0 w-px bg-energy-cyan opacity-0 transition-[left] duration-75"
        />
      </div>

      <div
        className="relative mt-0.5 h-3.5 font-mono text-[9px] text-text-muted"
        aria-hidden="true"
      >
        {TICKS_HZ.map((hz, i) => (
          <span
            key={hz}
            className={cn(
              'absolute top-0 whitespace-nowrap',
              i === TICKS_HZ.length - 1 ? '-translate-x-full' : i === 0 ? '' : '-translate-x-1/2',
              NARROW_HIDDEN.has(hz) && 'hidden sm:inline'
            )}
            style={{ left: `${freqToPosition(hz) * 100}%` }}
          >
            {hzLabel(hz)}
          </span>
        ))}
      </div>
    </div>
  );
}
