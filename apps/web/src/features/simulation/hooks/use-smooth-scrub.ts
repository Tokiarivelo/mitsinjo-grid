'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Glide length after a release or a button step (ms). */
export const SCRUB_SETTLE_MS = 160;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Thumb position `elapsed` ms into a glide from `from` to `to`. Pure, so it is unit-tested. */
export function glidePos(
  from: number,
  to: number,
  elapsed: number,
  durationMs: number,
  linear = false
): number {
  if (durationMs <= 0 || elapsed >= durationMs) return to;
  const t = Math.max(0, elapsed / durationMs);
  return from + (to - from) * (linear ? t : easeOutCubic(t));
}

/** Nearest whole hour for a fractional thumb position, clamped to [0, max]. */
export function scrubHour(pos: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(pos)));
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface SmoothScrubOptions {
  /** Last index (23 for a day). */
  max: number;
  /** Store index the thumb settles on. */
  value: number;
  /** Called only when the whole hour under the thumb changes. */
  onSeek: (index: number) => void;
  /** While playing, glide linearly over one tick so the thumb never stops between hours. */
  playingGlideMs?: number;
  /**
   * Live clock (scale model): on each new hour, run linearly from it toward the next one over
   * this many ms, so the thumb shows the time elapsed inside the hour.
   */
  leadMs?: number;
}

/**
 * Continuous thumb for a discrete hour slider: the thumb follows the pointer (and glides between
 * hours on playback or step buttons) while the store still only receives whole hours.
 */
export function useSmoothScrub({ max, value, onSeek, playingGlideMs, leadMs }: SmoothScrubOptions) {
  const [pos, setPos] = useState(value);
  const posRef = useRef(value);
  const dragging = useRef(false);
  const raf = useRef<number | null>(null);

  const setBoth = useCallback((p: number) => {
    posRef.current = p;
    setPos(p);
  }, []);

  const stop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const glideTo = useCallback(
    (to: number, durationMs: number, linear: boolean) => {
      stop();
      const from = posRef.current;
      // Wrap-around (23 → 0) or reduced motion: jump instead of sweeping the whole bar back.
      if (Math.abs(to - from) > max / 2 || durationMs <= 0 || prefersReducedMotion()) {
        setBoth(to);
        return;
      }
      const start = performance.now();
      const frame = (now: number) => {
        const elapsed = now - start;
        setBoth(glidePos(from, to, elapsed, durationMs, linear));
        raf.current = elapsed < durationMs ? requestAnimationFrame(frame) : null;
      };
      raf.current = requestAnimationFrame(frame);
    },
    [max, setBoth]
  );

  // Store moved (playback tick, step button, other control): glide the thumb there.
  useEffect(() => {
    if (dragging.current) return;
    if (leadMs !== undefined) {
      // Thumb should already be near `value` (end of the last lead); otherwise start from it.
      if (Math.abs(posRef.current - value) > 1) setBoth(value);
      glideTo(Math.min(value + 1, max), leadMs, true);
      return;
    }
    if (Math.abs(posRef.current - value) < 1e-3) return;
    const playing = playingGlideMs !== undefined;
    glideTo(value, playing ? playingGlideMs : SCRUB_SETTLE_MS, playing);
  }, [value, playingGlideMs, leadMs, max, glideTo, setBoth]);

  useEffect(() => stop, []);

  /** Raw slider value from a drag or a change event. */
  const onInput = (raw: number) => {
    if (Number.isNaN(raw)) return;
    stop();
    const clamped = Math.min(max, Math.max(0, raw));
    setBoth(clamped);
    const hour = scrubHour(clamped, max);
    if (hour !== value) onSeek(hour);
  };

  /** Release (anywhere on the page): settle the thumb on the hour it now shows. */
  const onDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    glideTo(scrubHour(posRef.current, max), SCRUB_SETTLE_MS, false);
  }, [glideTo, max]);

  const onDragStart = () => {
    dragging.current = true;
    stop();
    window.addEventListener('pointerup', onDragEnd, { once: true });
    window.addEventListener('pointercancel', onDragEnd, { once: true });
  };

  useEffect(
    () => () => {
      window.removeEventListener('pointerup', onDragEnd);
      window.removeEventListener('pointercancel', onDragEnd);
    },
    [onDragEnd]
  );

  return { pos, onInput, onDragStart, onDragEnd };
}
