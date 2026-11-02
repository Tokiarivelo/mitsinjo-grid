import type { InputPatch, Priority, SectorId } from '@mitsinjo/engine';

/**
 * Meeting → priorities (M10-T4): deterministic extraction from diarized turns. Keywords in
 * EN/FR/MG, accent-insensitive, whole-word. The patch only carries `priorities` (+ a lifeline
 * floor for never-cut wants); time notes stay on the priorities for the operator to read.
 */

export interface MeetingTurn {
  speaker?: string;
  text: string;
}

export type MeetingWant = 'protect' | 'mention' | 'deprioritize';

export interface MeetingPriority {
  speaker: string | null;
  sector: SectorId;
  want: MeetingWant;
  quote: string;
  timeNote?: 'morning' | 'midday' | 'evening' | 'night';
}

export interface MeetingExtraction {
  priorities: MeetingPriority[];
  patch: InputPatch;
  unmapped: { quote: string; reason: string }[];
}

const SECTOR_KEYWORDS: Record<SectorId, string[]> = {
  health: ['clinics?', 'cliniques?', 'dispensaire', 'hopital', 'pitsaboana'],
  water: ['water', 'eau', 'pompes?', 'pumps?', 'paompy', 'rano', 'forage', 'puits'],
  school: ['schools?', 'ecoles?', 'sekoly', 'eleves?', 'classe'],
  households: [
    'households?',
    'menages?',
    'foyers?',
    'fianakaviana',
    'tokantrano',
    'quartier',
    'neighborhood',
  ],
  market: ['markets?', 'marches?', 'tsena', 'magasin', 'boutique'],
  industry: ['industry', 'industrie', 'factory', 'usine', 'orinasa', 'moulin'],
};

const PROTECT_WORDS = [
  'never cut',
  'jamais coup',
  'tsy tapah',
  'keep',
  'garder',
  'toujours',
  'always',
  'dabord',
  'first',
  'voalohany',
  'priorite?s?',
  'priority',
  'prioritaire',
  'laharana',
  'all night',
  'toute la nuit',
];
const DEPRIORITIZE_WORDS = [
  'can close',
  'can wait',
  'fermer plus tot',
  'close earlier',
  'later',
  'plus tard',
  'moins',
  'less',
  'dernier',
  'farany',
  'peuvent attendre',
  'pas prioritaire',
  'not a priority',
];
const NEVER_CUT_WORDS = ['never cut', 'jamais coup', 'tsy tapahina', 'ne pas couper'];
const TIME_WORDS: Array<[MeetingPriority['timeNote'], string[]]> = [
  ['morning', ['morning', 'matin', 'maraina']],
  ['midday', ['midday', 'midi', 'mitataovovonana']],
  ['evening', ['evening', 'soir', 'hariva']],
  ['night', ['night', 'nuit', 'alina', 'toute la nuit', 'all night']],
];

const WANT_PRIORITY: Record<MeetingWant, Priority> = {
  protect: 'critical',
  mention: 'high',
  deprioritize: 'low',
};
/** On conflict the strongest want wins; ties keep the first turn. */
const WANT_RANK: Record<MeetingWant, number> = { protect: 3, mention: 2, deprioritize: 1 };

/** Lifeline floor proposed for never-cut wants (same as the constitution default). */
const NEVER_CUT_FLOOR_KW = 0.5;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ');
}

/**
 * Single-word sources are trusted token regexes (`menages?`); phrases are matched literally
 * with a leading boundary only, so `tsy tapah` catches `tapahina`/`tapahana`.
 */
function hasWord(normalized: string, source: string): boolean {
  if (!source.includes(' ')) {
    const token = new RegExp(`^(?:${source})$`);
    return normalized.split(/\s+/).some((t) => token.test(t));
  }
  const pattern = source
    .split(' ')
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(`\\b${pattern}`).test(normalized);
}

export function extractMeetingPriorities(turns: MeetingTurn[]): MeetingExtraction {
  const priorities: MeetingPriority[] = [];
  const unmapped: MeetingExtraction['unmapped'] = [];
  const best: Partial<Record<SectorId, MeetingWant>> = {};
  const floors: Partial<Record<SectorId, number>> = {};

  for (const turn of turns) {
    const text = normalize(turn.text);
    const sectors = (Object.keys(SECTOR_KEYWORDS) as SectorId[]).filter((sector) =>
      SECTOR_KEYWORDS[sector].some((kw) => hasWord(text, kw))
    );
    if (sectors.length === 0) {
      unmapped.push({ quote: turn.text, reason: 'no_sector' });
      continue;
    }
    const protect = PROTECT_WORDS.some((w) => hasWord(text, w));
    const drop = !protect && DEPRIORITIZE_WORDS.some((w) => hasWord(text, w));
    const want: MeetingWant = protect ? 'protect' : drop ? 'deprioritize' : 'mention';
    const neverCut = NEVER_CUT_WORDS.some((w) => hasWord(text, w));
    const timeNote = TIME_WORDS.find(([, words]) => words.some((w) => hasWord(text, w)))?.[0];
    for (const sector of sectors) {
      priorities.push({
        speaker: turn.speaker ?? null,
        sector,
        want,
        quote: turn.text,
        ...(timeNote ? { timeNote } : {}),
      });
      if (!best[sector] || WANT_RANK[want] > WANT_RANK[best[sector]]) best[sector] = want;
      if (neverCut) floors[sector] = NEVER_CUT_FLOOR_KW;
    }
  }

  const patch: InputPatch = {};
  if (Object.keys(best).length > 0) {
    patch.priorities = Object.fromEntries(
      Object.entries(best).map(([sector, want]) => [sector, WANT_PRIORITY[want as MeetingWant]])
    ) as InputPatch['priorities'];
  }
  if (Object.keys(floors).length > 0) patch.lifeline = { kw: floors };

  return { priorities, patch, unmapped };
}
