export interface SpeechEndOptions {
  /** RMS energy (0–1) at or above which a frame counts as speech. */
  threshold?: number;
  /** Silence after the last speech frame that ends the turn. */
  silenceMs?: number;
}

export interface SpeechEndDetector {
  /** Feed one energy frame; true once the turn has ended (latched until reset). */
  push(energy: number, nowMs: number): boolean;
  reset(): void;
}

/**
 * End-of-speech detector for hands-free mode (M3-T5): the turn ends after `silenceMs`
 * of quiet past the last speech frame. Silence alone never ends anything, so tapping the
 * microphone by mistake keeps recording until the speaker taps stop.
 */
export function createSpeechEndDetector({
  threshold = 0.015,
  silenceMs = 1200,
}: SpeechEndOptions = {}): SpeechEndDetector {
  let speechAt: number | null = null;
  let lastSpeechAt = 0;
  let ended = false;
  return {
    push(energy: number, nowMs: number): boolean {
      if (ended) return true;
      if (energy >= threshold) {
        if (speechAt === null) speechAt = nowMs;
        lastSpeechAt = nowMs;
        return false;
      }
      if (speechAt !== null && nowMs - lastSpeechAt >= silenceMs) {
        ended = true;
        return true;
      }
      return false;
    },
    reset() {
      speechAt = null;
      lastSpeechAt = 0;
      ended = false;
    },
  };
}
