import type { SectorId } from '@mitsinjo/engine';

/** Urgency words in a voice transcription (FR/EN/MG), any case. */
const URGENCY_WORDS = /\b(au feu|on fire|incendie|feu|afo|fire)\b/i;

/**
 * Sector aliases in a transcription. Mirrors the copilot mock's `MOCK_SECTOR_WORDS`
 * (kept local: the mock is server-only and this runs in the browser).
 */
const SECTOR_WORDS: Array<{ match: RegExp; sector: SectorId }> = [
  { match: /market|marché|tsena/i, sector: 'market' },
  { match: /school|école|sekoly/i, sector: 'school' },
  { match: /industr|factory|usine|atelier|ozinina/i, sector: 'industry' },
  { match: /\b(water|pump|eau|pompe|rano)\b/i, sector: 'water' },
  { match: /household|foyer|ménage|tokantrano/i, sector: 'households' },
  { match: /clinic|clinique|santé|health|toeram-pahasalamana/i, sector: 'health' },
];

/**
 * Fire order in a voice transcription (M3-T3, F5): urgency words plus a sector.
 * Null when the sentence is not a fire report — the text goes to the chat as usual.
 */
export function detectVoiceFireOrder(text: string): SectorId | null {
  if (!URGENCY_WORDS.test(text)) return null;
  return SECTOR_WORDS.find((s) => s.match.test(text))?.sector ?? null;
}
