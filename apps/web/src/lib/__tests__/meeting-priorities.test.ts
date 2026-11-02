import { describe, expect, it } from 'vitest';
import { extractMeetingPriorities } from '../meeting-priorities';

const MOCK_TURNS: [
  { speaker: string; text: string },
  { speaker: string; text: string },
  { speaker: string; text: string },
] = [
  { speaker: 'A', text: 'La clinique doit garder le courant toute la nuit.' },
  { speaker: 'B', text: "L'école a besoin de lumière le matin." },
  { speaker: 'A', text: 'Le marché peut fermer plus tôt le soir.' },
];

describe('extractMeetingPriorities (M10-T4)', () => {
  it('maps the mock meeting to who-wants-what + a priorities patch', () => {
    const res = extractMeetingPriorities(MOCK_TURNS);
    expect(res.priorities).toEqual([
      {
        speaker: 'A',
        sector: 'health',
        want: 'protect',
        quote: MOCK_TURNS[0].text,
        timeNote: 'night',
      },
      {
        speaker: 'B',
        sector: 'school',
        want: 'mention',
        quote: MOCK_TURNS[1].text,
        timeNote: 'morning',
      },
      {
        speaker: 'A',
        sector: 'market',
        want: 'deprioritize',
        quote: MOCK_TURNS[2].text,
        timeNote: 'evening',
      },
    ]);
    expect(res.patch).toEqual({
      priorities: { health: 'critical', school: 'high', market: 'low' },
    });
    expect(res.unmapped).toEqual([]);
  });

  it('never-cut wants add a lifeline floor (EN + MG)', () => {
    const res = extractMeetingPriorities([
      { text: 'Never cut the clinic.' },
      { speaker: 'C', text: 'Tsy tapahina mihitsy ny paompy.' },
    ]);
    expect(res.patch).toEqual({
      priorities: { health: 'critical', water: 'critical' },
      lifeline: { kw: { health: 0.5, water: 0.5 } },
    });
  });

  it('strongest want wins on conflict; sector-less turns are unmapped', () => {
    const res = extractMeetingPriorities([
      { speaker: 'A', text: 'The market can close earlier.' },
      { speaker: 'B', text: 'The market first, it feeds the village!' },
      { text: 'We need more light everywhere.' },
    ]);
    expect(res.priorities.map((p) => p.want)).toEqual(['deprioritize', 'protect']);
    expect(res.patch.priorities).toEqual({ market: 'critical' });
    expect(res.unmapped).toEqual([
      { quote: 'We need more light everywhere.', reason: 'no_sector' },
    ]);
  });

  it('empty meeting → empty patch, nothing unmapped', () => {
    expect(extractMeetingPriorities([])).toEqual({ priorities: [], patch: {}, unmapped: [] });
  });
});
