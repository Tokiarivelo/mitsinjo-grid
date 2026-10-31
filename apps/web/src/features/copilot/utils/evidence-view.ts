import type { CopilotEvidence } from '../types';

/**
 * Rows that never help the reader of an answer: fixed scenario settings (shown in the context panel)
 * and peak hours printed as bare numbers.
 */
const HIDDEN_CHANNELS = new Set([
  'solarPeakKw',
  'batteryCapacityKwh',
  'socStartPct',
  'peakSolarHour',
  'peakDemandHour',
  'lowestSocHour',
]);

/** Engine evidence of one answer, split into what is shown and what is folded under "show all". */
export interface EvidenceView {
  shown: CopilotEvidence[];
  folded: CopilotEvidence[];
}

function cleanFields(fields: CopilotEvidence['fields']): CopilotEvidence['fields'] {
  const out: CopilotEvidence['fields'] = {};
  for (const [key, value] of Object.entries(fields)) {
    if (HIDDEN_CHANNELS.has(key)) continue;
    // Same value as the minimum SoC of the metrics.
    if (key === 'lowestSocPct' && 'socMinPct' in fields) continue;
    out[key] = value;
  }
  return out;
}

/**
 * One table per answer: the last tool result (the one the answer is about). Earlier lookups are folded.
 * With a proposal, its card already shows the engine before/after, so every table is folded.
 */
export function evidenceView(
  evidence: readonly CopilotEvidence[] | undefined,
  hasProposal: boolean
): EvidenceView {
  const cleaned = (evidence ?? [])
    .map((e) => ({ ...e, fields: cleanFields(e.fields) }))
    .filter((e) => Object.keys(e.fields).length > 0);
  if (hasProposal) return { shown: [], folded: cleaned };
  return { shown: cleaned.slice(-1), folded: cleaned.slice(0, -1) };
}
