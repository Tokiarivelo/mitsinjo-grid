/** Minimal voice shape (structural, so the choice is testable without DOM voices). */
export interface SpeechVoiceLike {
  lang: string;
  name: string;
}

/**
 * Preferred speech voice for a locale (M3-T4): the first voice whose language matches the
 * locale's base language (`fr` → `fr-FR`, `fr-CA`, …). Null when none matches — Malagasy then
 * stays text-only, since browsers rarely ship an `mg` voice.
 */
export function pickSpeechVoice<T extends SpeechVoiceLike>(
  voices: readonly T[],
  locale: string
): T | null {
  const base = locale.toLowerCase().split('-')[0];
  return (
    voices.find((v) => {
      const lang = v.lang.toLowerCase();
      return lang === base || lang.startsWith(`${base}-`);
    }) ?? null
  );
}
