import 'server-only';

import type { LlmProvider, ChatMessage, ToolDefinition, LlmTurn, ToolCall } from '../provider';
import { scenarios, simulate, type SectorId } from '@mitsinjo/engine';
import { describeAnalyze, describeSegment } from '../model-tools';
import { rememberResult } from '../result-cache';
import { parseAppHour } from '../prompt';

/** Model id reported (and accepted) when `LLM_PROVIDER=mock`. */
export const MOCK_MODEL_ID = 'mock-deterministic-v1';

/**
 * Offline stand-ins for Spark's own tool choice (model-switch tools). Only the mock reads keywords:
 * with Meta, Spark decides from the meaning of the request.
 */
const MOCK_IMAGE_WORDS =
  /(génère une image|générer une image|crée une image|dessine|illustration|affiche|generate an? (image|picture)|draw|mamorona sary)/i;
const MOCK_VILLAGE_NOW =
  /(état du village|village actuel|village maintenant|montre(-moi)? le village|show (me )?the village|current village|village now)/i;
const MOCK_COUNT_WORDS = /(combien|compte |compte-|count|how many|détecte|detect|ohatrinona)/i;
/** Vision questions on the attached photo (M4-T2): observe, don't count. */
const MOCK_VISION_WORDS =
  /(what do you see|que vois|qu'est-ce qu'on voit|inona no hita|photo|image|picture|sary|sky|ciel|lanitra|cloud|nuage|rahona|meter|compteur|famantaranandro|panel|panneau|ombre|shade|smoke|fumée)/i;
/** Evening village visual / shedding poster → generate_visual from an engine result (M5-T1). */
const MOCK_VISUAL_VILLAGE_WORDS = /(village (ce soir|cette nuit|tonight)|tanàna anio alina)/i;
const MOCK_VISUAL_POSTER_WORDS = /(affiche de |affiche du |shedding poster|load-?shedding poster)/i;
/** Sector council → convene_council (M7-T1). Bare "conseil" (= advice) is not enough. */
const MOCK_COUNCIL_WORDS = /(council|(conseil.*agent)|(agent.*conseil)|convoque)/i;
/** Battery post-mortem → get_battery_story (M7-T3). */
const MOCK_BATTERY_WORDS = /\b(batter\w*|battery|batteries)\b/i;
const MOCK_STORY_WHY_WORDS =
  /(pourquoi|why|explain|explique|raconte|post-?mortem|vide|empty|faible|low|déchargé|discharged)/i;
/** Week simulation → simulate_week (M7-T2). */
const MOCK_WEEK_WORDS = /\b(week|semaine|7 days|7 jours|seven days)\b/i;
const MOCK_WEATHER_DEFS: Array<{ match: RegExp; weather: string }> = [
  { match: /\bstorm\w*|\orage|tempête/gi, weather: 'storm' },
  { match: /\brain\w*|pluie|pluvieux/gi, weather: 'rainy' },
  { match: /partly[ _-]?cloudy|éclaircies/gi, weather: 'partly_cloudy' },
  { match: /\bcloud\w*|nuage\w*|couvert/gi, weather: 'cloudy' },
  { match: /\bsun\w*|soleil|ensoleillé|beau temps/gi, weather: 'sunny' },
];

/** Weather words in order of appearance (a "partly cloudy" is not also a "cloudy"). */
function mockWeekDays(query: string): { weather: string }[] {
  const hits: { index: number; weather: string }[] = [];
  for (const def of MOCK_WEATHER_DEFS) {
    def.match.lastIndex = 0;
    for (const m of query.matchAll(def.match))
      hits.push({ index: m.index ?? 0, weather: def.weather });
  }
  hits.sort((a, b) => a.index - b.index);
  const days: { weather: string }[] = [];
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const prevHit = i > 0 ? hits[i - 1]! : undefined;
    if (
      hit.weather === 'cloudy' &&
      prevHit?.weather === 'partly_cloudy' &&
      hit.index - prevHit.index < 10
    ) {
      continue;
    }
    days.push({ weather: hit.weather });
    if (days.length >= 7) break;
  }
  return days;
}

/** Fewer days named than a week asks for → the last weather fills the week. */
function mockPadWeek(days: { weather: string }[]): { weather: string }[] {
  if (days.length === 0) {
    return ['sunny', 'sunny', 'partly_cloudy', 'cloudy', 'rainy', 'cloudy', 'sunny'].map(
      (weather) => ({ weather })
    );
  }
  const out = [...days];
  while (out.length < 7) out.push(out[out.length - 1]!);
  return out;
}
/** "What should we do?" → the mock chains a proposal after an observation (M4-T5). */
const MOCK_ACTION_WORDS =
  /(what should|what to do|what do you recommend|que faire|quoi faire|faut-il faire|que recommand|propose|suggest|inona no atao)/i;
const MOCK_SEGMENT_CONCEPTS: Array<{ match: RegExp; concept: string }> = [
  { match: /fumée|smoke|setroka/i, concept: 'smoke' },
  { match: /toit|roof|tafo/i, concept: 'roof' },
  { match: /maison|house|trano/i, concept: 'house' },
  { match: /arbre|tree|hazo/i, concept: 'tree' },
];

/** "Cut <sector> now" (K2). Power-switch wording ("turn off", "éteindre") keeps the hardware refusal. */
const MOCK_CUT_WORDS = /\b(cut|coupe|couper|coupez|délest\w*|tapaho)\b/i;
const MOCK_NOW_WORDS = /\b(now|maintenant|ankehitriny)\b/i;
/** A time given in the request ("tonight", "18 h", "de 8 à 12"…): a cut without one starts now. */
const MOCK_TIME_WORDS =
  /\b(tonight|this evening|morning|from|until|between|ce soir|soir|matin|nuit|demain|jusqu|entre|de \d|à \d|\d{1,2}\s?(h|:00|am|pm))\b|\d{1,2}\s?h\b/i;
/** "Don't cut…" is not a cut order. */
const MOCK_NEGATION_WORDS = /\b(don't|do not|ne coupe[sz]? pas|sans couper|aza)\b/i;
const MOCK_SECTOR_WORDS: Array<{ match: RegExp; sector: SectorId }> = [
  { match: /market|marché|tsena/i, sector: 'market' },
  { match: /school|école|sekoly/i, sector: 'school' },
  { match: /industr|factory|usine|atelier|ozinina/i, sector: 'industry' },
  { match: /\b(water|pump|eau|pompe|rano)\b/i, sector: 'water' },
  { match: /household|foyer|ménage|tokantrano/i, sector: 'households' },
  { match: /clinic|clinique|santé|health|toeram-pahasalamana/i, sector: 'health' },
];
/** "…, garde la clinique" / "keep the clinic" / "sauf l'école": sectors named after it are kept (K3). */
const MOCK_KEEP_WORDS = /\b(garde[rz]?|keep|sauf|except|tazony|avelao)\b/i;

/** Sectors a cut order names, in a fixed order, leaving out those after a "keep" word (K3). */
export function mockCutSectors(query: string): SectorId[] {
  const cutPart = query.split(MOCK_KEEP_WORDS)[0] ?? query;
  return MOCK_SECTOR_WORDS.filter((s) => s.match.test(cutPart)).map((s) => s.sector);
}

/** "Limit <sector> to <N> kW [from H to H]" (M1-T6): power words + a kW value + a sector. */
const MOCK_LIMIT_WORDS = /\b(limit\w*|limite\w*|plafon\w*|caps?|capped)\b/i;
const MOCK_KW_VALUE = /(-?\d+(?:[.,]\d+)?)\s*kW\b/i;
const MOCK_RANGE_EN = /from\s+(\d{1,2})\s*(?::00|h)?\s*(?:to|-|–)\s*(\d{1,2})\s*(?::00|h)?/i;
const MOCK_RANGE_FR = /de\s+(\d{1,2})\s*h?\s*(?:à|a)\s*(\d{1,2})\s*h?/i;

/** Power-cap order the mock sends to propose_change, or null when the question is not one. */
export function mockLimitCap(
  query: string,
  appHour: number
): { sector: SectorId; maxKw: number; fromHour: number; toHour: number } | null {
  if (!MOCK_LIMIT_WORDS.test(query)) return null;
  const value = MOCK_KW_VALUE.exec(query);
  const sector = MOCK_SECTOR_WORDS.find((s) => s.match.test(query))?.sector;
  if (!value?.[1] || !sector) return null;
  const maxKw = Number(value[1].replace(',', '.'));
  const range = MOCK_RANGE_EN.exec(query) ?? MOCK_RANGE_FR.exec(query);
  const tonight = /\b(tonight|ce soir)\b/i.test(query);
  return {
    sector,
    maxKw,
    fromHour: range ? Number(range[1]) : tonight ? 18 : appHour,
    toHour: range ? Number(range[2]) : 24,
  };
}

/** Fire questions (M2-T4): incident words + a sector → get_incidents (read-only, never a proposal). */
const MOCK_FIRE_WORDS = /\b(fire|fires|incendie|incident|incidents|feu|afo|brûle\w*|burn\w*)\b/i;
/** Restore orders (M2-T4): restore verbs + a sector, no question word → propose clearFires. */
const MOCK_RESTORE_WORDS = /\b(rétabli\w*|restor\w*|remets?|remettre|remettez|rebranch\w*)\b/i;
const MOCK_QUESTION_WORDS = /\b(comment|how|ahoana|pourquoi|why)\b/i;

/** Sector a restore order names, or null (a "how to restore" question explains instead). */
export function mockRestoreSector(query: string): SectorId | null {
  if (!MOCK_RESTORE_WORDS.test(query)) return null;
  if (MOCK_QUESTION_WORDS.test(query)) return null;
  return MOCK_SECTOR_WORDS.find((s) => s.match.test(query))?.sector ?? null;
}

/** Playback words need a timeline noun, or the order alone ("pause", "lecture"), so "lance une simulation" is not "play". */
const MOCK_PLAYBACK_NOUN = /\b(lecture|animation|timeline|playback|journ|curseur|fandaharana)/i;
const MOCK_PLAYBACK_ACTIONS: Array<{
  match: RegExp;
  action: 'play' | 'pause' | 'stop' | 'restart';
}> = [
  { match: /\b(restart|recommence\w*|redémarre\w*|averina|avereno)\b/i, action: 'restart' },
  { match: /\b(pause|ampiato\w*)\b/i, action: 'pause' },
  { match: /\b(stop|arrête\w*|arrêter|ajanony)\b/i, action: 'stop' },
  { match: /\b(play|lance\w*|joue\w*|démarre\w*|start|alefaso|lecture)\b/i, action: 'play' },
];
/** "Go to 18:00" / "va à 18 h" / "mandehana amin'ny 18". */
const MOCK_SEEK =
  /\b(?:go to|jump to|move to|va à|aller à|passe à|avance à|mandehana amin'ny)\s*(\d{1,2})\s*(?:h\b|:00)?/i;

/** Playback order the mock sends to control_playback, or null when the question is not one. */
export function mockPlaybackCommand(
  query: string
): { action: 'play' | 'pause' | 'stop' | 'restart' | 'seek'; hour?: number } | null {
  const seek = MOCK_SEEK.exec(query);
  if (seek) {
    const hour = Number(seek[1]);
    return hour >= 0 && hour <= 23 ? { action: 'seek', hour } : null;
  }
  const words = query.trim().split(/\s+/).length;
  if (!MOCK_PLAYBACK_NOUN.test(query) && words > 2) return null;
  const hit = MOCK_PLAYBACK_ACTIONS.find((a) => a.match.test(query));
  return hit ? { action: hit.action } : null;
}

const MOCK_PLAYBACK_DONE: Record<'en' | 'fr' | 'mg', Record<string, string>> = {
  en: {
    play: 'Playback started.',
    pause: 'Playback paused.',
    stop: 'Playback stopped, back to 00:00.',
    restart: 'Playback restarted from 00:00.',
    seek: 'Time cursor moved to {hour}.',
    tail: 'Only the view moved; no setting changed.',
  },
  fr: {
    play: 'Lecture lancée.',
    pause: 'Lecture en pause.',
    stop: 'Lecture arrêtée, retour à 00:00.',
    restart: 'Lecture relancée depuis 00:00.',
    seek: 'Curseur déplacé à {hour}.',
    tail: "Seule la vue a changé ; aucun réglage n'a été modifié.",
  },
  mg: {
    play: 'Natomboka ny famakiana.',
    pause: 'Najanona kely ny famakiana.',
    stop: "Najanona ny famakiana, miverina amin'ny 00:00.",
    restart: "Naverina hatramin'ny 00:00 ny famakiana.",
    seek: "Nafindra amin'ny {hour} ny ora.",
    tail: 'Ny fijery ihany no niova; tsy nisy masontsivana novaina.',
  },
};

/** One-line answer after control_playback ran. */
export function playbackDoneAnswer(
  action: string,
  hour: number | undefined,
  lang: 'en' | 'fr' | 'mg'
): string {
  const t = MOCK_PLAYBACK_DONE[lang];
  const hh = `${String(hour ?? 0).padStart(2, '0')}:00`;
  return `${(t[action] ?? t.play!).replace('{hour}', hh)} ${t.tail}`;
}

/** Same default as the loop when the client sends no hour. */
const MOCK_DEFAULT_HOUR = 12;

/** Hour from the loop's app-context system note, if any. */
function appHourFrom(messages: ChatMessage[]): number | undefined {
  for (const m of messages) {
    if (m.role !== 'system') continue;
    const hour = parseAppHour(m.content ?? '');
    if (hour !== undefined) return hour;
  }
  return undefined;
}

function mockSegmentConcept(query: string): string {
  return MOCK_SEGMENT_CONCEPTS.find((c) => c.match.test(query))?.concept ?? 'solar panel';
}

function isFrenchQuery(text: string): boolean {
  const q = text.toLowerCase();
  return (
    q.includes('centre de santé') ||
    q.includes('santé') ||
    q.includes('clinique') ||
    q.includes('solaire') ||
    q.includes('stratégie') ||
    q.includes('strategies') ||
    q.includes('batterie') ||
    q.includes('pourquoi') ||
    q.includes('comment') ||
    q.includes('que se passe') ||
    q.includes('protéger') ||
    q.includes('proposer') ||
    q.includes('changer') ||
    q.includes('comparer') ||
    q.includes('chute') ||
    q.includes('baisse') ||
    q.includes('réseau') ||
    q.includes('poème') ||
    q.includes('hier') ||
    q.includes('éteindre') ||
    q.includes('couper') ||
    q.includes('maintenant') ||
    q.includes('marché') ||
    q.includes('combien') ||
    q.includes('maison') ||
    q.includes('génère') ||
    q.includes('dessine') ||
    q.includes("c'est fait") ||
    q.includes('est-ce') ||
    q.includes('appliqué') ||
    q.includes('incendie') ||
    q.includes('brûle') ||
    q.includes('rétabli') ||
    q.includes('bilan') ||
    q.includes('conseil') ||
    q.includes('convoque') ||
    q.includes('délester') ||
    q.includes('le feu')
  );
}

/** Chart answer built only from the `get_grid_state(hourly)` tool result (engine values, already rounded). */
export function describeProfileChart(payload: Record<string, unknown>, fr: boolean): string {
  const hourly = payload.hourly as {
    t: number;
    solarKw: number;
    demandKw: number;
    socPct: number;
  }[];
  const h = (payload.highlights ?? {}) as Record<string, number>;
  const resultId = String(payload.resultId ?? '');
  const chart = JSON.stringify({
    type: 'line',
    title: fr
      ? 'Production solaire, charge et batterie (24 h)'
      : '24 h solar production, load and battery',
    xAxisKey: 'hour',
    series: [
      { key: 'solar', label: fr ? 'Solaire PV (kW)' : 'Solar PV (kW)' },
      { key: 'demand', label: fr ? 'Charge totale (kW)' : 'Total load (kW)' },
      { key: 'battery', label: fr ? 'SoC batterie (%)' : 'Battery SoC (%)' },
    ],
    data: hourly.map((p) => ({
      hour: `${String(p.t).padStart(2, '0')}h`,
      solar: p.solarKw,
      demand: p.demandKw,
      battery: p.socPct,
    })),
  });
  const at = (hour: number | undefined) => `${String(hour ?? 0).padStart(2, '0')}:00`;
  return fr
    ? `### Ce qui s'est passé\nProfil simulé sur 24 h : production solaire, charge du village et état de charge de la batterie (moteur, ${resultId}).\n\n` +
        `\`\`\`chart\n${chart}\n\`\`\`\n\n` +
        `### Preuves calculées\n- Pointe solaire : ${h.peakSolarKw} kW à ${at(h.peakSolarHour)}\n- Pointe de charge : ${h.peakDemandKw} kW à ${at(h.peakDemandHour)}\n- SoC batterie le plus bas : ${h.lowestSocPct} % à ${at(h.lowestSocHour)}\n\n` +
        `### Pourquoi c'est important\nLes heures où la charge dépasse le solaire vident la batterie : ce sont elles qui menacent les services essentiels.\n\n` +
        `### Et ensuite\nTester une baisse d'ensoleillement pour voir la batterie descendre plus tôt.`
    : `### What happened\nSimulated 24 h profile: solar production, village load and battery state of charge (engine, ${resultId}).\n\n` +
        `\`\`\`chart\n${chart}\n\`\`\`\n\n` +
        `### Computed evidence\n- Solar peak: ${h.peakSolarKw} kW at ${at(h.peakSolarHour)}\n- Load peak: ${h.peakDemandKw} kW at ${at(h.peakDemandHour)}\n- Lowest battery SoC: ${h.lowestSocPct}% at ${at(h.lowestSocHour)}\n\n` +
        `### Why it matters\nHours where load exceeds solar drain the battery: those are the hours that threaten essential services.\n\n` +
        `### Explore next\nSimulate a solar drop to see the battery fall earlier.`;
}

type ToolErrorKind = 'unclear_change' | 'out_of_bounds' | 'other';

/** What kind of tool failure this is, from the tool's error text (never shown to the user). */
export function toolErrorKind(toolName: string, error: string): ToolErrorKind {
  if (
    error.startsWith('Failed to apply patch') ||
    /must be (less|greater) than|too_(big|small)|out of range/i.test(error)
  ) {
    return 'out_of_bounds';
  }
  if (toolName === 'propose_change') return 'unclear_change';
  return 'other';
}

const TOOL_ERROR_TEXT: Record<
  'en' | 'fr' | 'mg',
  Record<ToolErrorKind, [string, string, string, string]>
> = {
  en: {
    unclear_change: [
      'I did not understand which change to make, so nothing was proposed.',
      'Name the sector and, if you want, the time. Without a time, a cut starts at the hour shown in the app.',
      'Every change goes through an approval card with its engine impact; nothing is applied without your click.',
      'Try "Cut the market now" or "Limit the school to 2 kW from 18:00 to 22:00".',
    ],
    out_of_bounds: [
      'The change you asked for is outside what the simulator accepts, so nothing was proposed.',
      'One of the values is out of its allowed range (for example a negative power or an hour past 24).',
      'The simulator refuses values a real microgrid could not run, to keep every result meaningful.',
      'Ask again with a smaller value or another time range.',
    ],
    other: [
      'The simulator could not compute this request.',
      'One of the parameters was not understood.',
      'No number is shown when the engine could not compute it.',
      'Rephrase the question, or press Retry for a new answer.',
    ],
  },
  fr: {
    unclear_change: [
      "Je n'ai pas compris quel changement appliquer : aucune proposition n'a été faite.",
      "Précisez le secteur et, si vous voulez, l'heure. Sans heure, une coupure commence à l'heure affichée dans l'app.",
      "Chaque changement passe par une carte d'approbation avec son impact calculé ; rien ne s'applique sans votre clic.",
      "Essayez « Coupe le marché maintenant » ou « Limite l'école à 2 kW de 18 h à 22 h ».",
    ],
    out_of_bounds: [
      "Le changement demandé sort de ce que le simulateur accepte : aucune proposition n'a été faite.",
      'Une des valeurs est hors de sa plage (par exemple une puissance négative ou une heure après 24 h).',
      "Le simulateur refuse les valeurs qu'un vrai micro-réseau ne pourrait pas appliquer, pour garder des résultats fiables.",
      'Redemandez avec une valeur plus petite ou une autre plage horaire.',
    ],
    other: [
      "Le simulateur n'a pas pu calculer cette demande.",
      "Un des paramètres n'a pas été compris.",
      "Aucun chiffre n'est affiché quand le moteur n'a pas pu le calculer.",
      'Reformulez la question, ou appuyez sur Réessayer pour une nouvelle réponse.',
    ],
  },
  mg: {
    unclear_change: [
      'Tsy azoko hoe inona no fanovana tianao: tsy nisy tolo-kevitra natao.',
      "Lazao ny sehatra ary, raha tianao, ny ora. Raha tsy misy ora dia manomboka amin'ny ora aseho ao amin'ny app ny fanapahana.",
      "Mandalo amin'ny karatra fankatoavana misy ny vokany voakajy ny fanovana rehetra; tsy misy ampiharina raha tsy tsindrianao.",
      'Andramo « Tapaho ny tsena ankehitriny ».',
    ],
    out_of_bounds: [
      'Mihoatra ny ekena ny simulateur ny fanovana nangatahinao: tsy nisy tolo-kevitra natao.',
      'Misy sanda iray mivoaka ny fetrany (ohatra hery ratsy na ora mihoatra ny 24).',
      'Lavin’ny simulateur ny sanda tsy azo ampiharina amin’ny tambajotra tena izy.',
      'Angataho indray amin’ny sanda kely kokoa na ora hafa.',
    ],
    other: [
      'Tsy afaka nanao kajy ity fangatahana ity ny simulateur.',
      'Misy masontsivana iray tsy azo.',
      'Tsy misy tarehimarika aseho raha tsy afaka nanao kajy ny motera.',
      'Avereno amin’ny fomba hafa ny fanontaniana, na tsindrio Andramo indray.',
    ],
  },
};

const ERROR_HEADINGS: Record<'en' | 'fr' | 'mg', [string, string, string, string]> = {
  en: ['What happened', 'Computed evidence', 'Why it matters', 'Explore next'],
  fr: ["Ce qui s'est passé", 'Preuves calculées', "Pourquoi c'est important", 'Et ensuite'],
  mg: ['Inona no nitranga', 'Porofo voakajy', 'Nahoana no zava-dehibe', "Dingan'ny hoavy"],
};

/**
 * Plain answer when a tool failed (offline copilot): in the app language, per kind of failure.
 * The raw validation error stays in the logs and the model's tool result, never in the chat.
 */
export function toolErrorAnswer(toolName: string, error: string, lang: 'en' | 'fr' | 'mg'): string {
  const text = TOOL_ERROR_TEXT[lang][toolErrorKind(toolName, error)];
  return ERROR_HEADINGS[lang].map((h, i) => `### ${h}\n${text[i]}`).join('\n\n');
}

/** Multi-day scenario drafting cue (PA-T8): "jour 2", "day 3", "andro 1", "3 jours", "multi-day". */
const MOCK_MULTI_DAY_WORDS =
  /\b(?:jour|day|andro)\s*[1-7]\b|\b[2-7]\s*(?:jours|days|andro)\b|plusieurs\s+jours|maro\s+andro|multi[-\s]?(?:day|jours?)|draft\s+scenario/i;

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  /** App language; without it the language is guessed from the question. */
  private readonly locale?: 'en' | 'fr' | 'mg';

  constructor(options?: { locale?: 'en' | 'fr' | 'mg' }) {
    this.locale = options?.locale;
  }

  private isFrench(text: string): boolean {
    return this.locale ? this.locale === 'fr' : isFrenchQuery(text);
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<LlmTurn> {
    void tools;
    void signal;
    // Check if the last message is a tool response
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'tool') {
      console.info(
        `[copilot:mock] Handling tool result for toolCallId: "${lastMsg.toolCallId || 'unknown'}"`
      );
      return this.handleToolResult(lastMsg, messages);
    }

    // Find the last user message
    const userMsg = [...messages].reverse().find((m) => m.role === 'user');
    const query = (userMsg?.content || '').toLowerCase();
    const fr = this.isFrench(query);
    console.info(
      `[copilot:mock] Generating synthetic response for user query: "${userMsg?.content?.slice(0, 50).replace(/\n/g, ' ') || ''}..." (french: ${fr})`
    );

    const playback = mockPlaybackCommand(query);
    if (playback) {
      return { toolCalls: [{ id: 'call_playback', name: 'control_playback', args: playback }] };
    }

    const hasImage = Boolean(userMsg?.media?.some((m) => m.type === 'image'));
    if (hasImage && MOCK_COUNT_WORDS.test(query)) {
      return {
        toolCalls: [
          {
            id: 'call_segment',
            name: 'segment_image',
            args: { concept: mockSegmentConcept(query) },
          },
        ],
      };
    }
    if (hasImage && MOCK_VISION_WORDS.test(query)) {
      return {
        toolCalls: [
          {
            id: 'call_analyze',
            name: 'analyze_image',
            args: { question: (userMsg?.content || '').slice(0, 300) },
          },
        ],
      };
    }
    if (
      !hasImage &&
      (MOCK_VISUAL_POSTER_WORDS.test(query) || MOCK_VISUAL_VILLAGE_WORDS.test(query))
    ) {
      // The mock only knows the baseline: simulate it, remember it, illustrate it.
      const visualInput = scenarios.baseline.input;
      const visualResult = simulate(visualInput, 'proportional');
      rememberResult(visualInput, visualResult);
      return {
        toolCalls: [
          {
            id: 'call_visual',
            name: 'generate_visual',
            args: {
              kind: MOCK_VISUAL_POSTER_WORDS.test(query) ? 'shedding_poster' : 'village_tonight',
              resultId: visualResult.id,
            },
          },
        ],
      };
    }
    if (!hasImage && MOCK_COUNCIL_WORDS.test(query)) {
      return {
        toolCalls: [
          {
            id: 'call_council',
            name: 'convene_council',
            args: { question: (userMsg?.content || '').slice(0, 300) },
          },
        ],
      };
    }
    if (!hasImage && MOCK_BATTERY_WORDS.test(query) && MOCK_STORY_WHY_WORDS.test(query)) {
      const hourMatch = query.match(/\b(\d{1,2})\s?h\b/) || query.match(/\bat\s+(\d{1,2})\b/);
      const hour =
        hourMatch?.[1] !== undefined ? Math.min(23, parseInt(hourMatch[1], 10)) : undefined;
      return {
        toolCalls: [
          {
            id: 'call_battery_story',
            name: 'get_battery_story',
            args: hour !== undefined ? { hour } : {},
          },
        ],
      };
    }
    if (!hasImage && MOCK_WEEK_WORDS.test(query)) {
      return {
        toolCalls: [
          {
            id: 'call_week',
            name: 'simulate_week',
            args: { days: mockPadWeek(mockWeekDays(query)) },
          },
        ],
      };
    }
    if (!hasImage && MOCK_VILLAGE_NOW.test(query)) {
      return {
        toolCalls: [
          { id: 'call_village', name: 'generate_image', args: { scene: 'current_village' } },
        ],
      };
    }
    if (!hasImage && MOCK_IMAGE_WORDS.test(query)) {
      return {
        toolCalls: [
          {
            id: 'call_image',
            name: 'generate_image',
            args: {
              prompt: `Rural Malagasy village with a solar microgrid: ${userMsg?.content ?? ''}`,
            },
          },
        ],
      };
    }

    // Multimodal simulated response if user attached media
    if (userMsg?.media && userMsg.media.length > 0) {
      const hasVideo = userMsg.media.some((m) => m.type === 'video');
      const mediaType = hasVideo ? 'vidéo' : 'image';
      return {
        content: fr
          ? `### Analyse visuelle du micro-réseau\nJ'ai bien analysé votre ${mediaType} jointe relative à la configuration du micro-réseau.\n\n` +
            `**Constatations clés :**\n` +
            `- **Composants détectés :** Panneaux photovoltaïques, onduleur central et liaison batterie.\n` +
            `- **Alignement simulation :** À comparer avec la puissance PV et la batterie du scénario actif (demandez « état du réseau » pour les valeurs du moteur).\n` +
            `- **Recommandation :** Vous pouvez lancer une simulation avec une chute d'ensoleillement de 40% pour tester la résilience.`
          : `### Microgrid Visual Analysis\nI have inspected the attached ${hasVideo ? 'video' : 'image'} regarding your microgrid layout.\n\n` +
            `**Key Observations:**\n` +
            `- **Detected Components:** Solar PV array, centralized inverter, and battery storage link.\n` +
            `- **Simulation Alignment:** Compare with the PV power and battery of the active scenario (ask for the grid state to get the engine values).\n` +
            `- **Recommendation:** Run a stress simulation with a 40% solar drop to evaluate resilience.`,
      };
    }

    // Chart / Graph request handler
    if (
      query.includes('chart') ||
      query.includes('graphe') ||
      query.includes('graphique') ||
      query.includes('courbe') ||
      query.includes('diagramme')
    ) {
      // Chart values come from the engine: ask for the 24 h series, build the chart from the result.
      return {
        toolCalls: [{ id: 'call_chart_profile', name: 'get_grid_state', args: { hourly: true } }],
      };
    }

    // Inserted appliance edit (PV-T11b demo): "set the pump to 900 watts" → edit_appliance.
    // The id is fixed (pump-1): the demo input carries it; without it the tool answers unknown-id.
    if ((query.includes('pump') || query.includes('pompe')) && query.includes('watt')) {
      const watts = Number(/(\d[\d\s]*)\s*watts?/.exec(query)?.[1]?.replace(/\s/g, '')) || 900;
      return {
        toolCalls: [
          {
            id: 'call_edit_appliance',
            name: 'edit_appliance',
            args: { id: 'pump-1', watts, reason: `Set the pump to ${watts} W.` },
          },
        ],
      };
    }

    // Scope guardrail: refuse off-topic requests (P6-T12 / Eval case 9)
    if (
      query.includes('poem') ||
      query.includes('poème') ||
      query.includes('paris') ||
      query.includes('recipe') ||
      query.includes('recette') ||
      query.includes('joke') ||
      query.includes('blague') ||
      query.includes('weather') ||
      query.includes('météo') ||
      query.includes('capital of')
    ) {
      if (fr) {
        return {
          content: `### What happened
Je ne peux répondre qu'aux questions et analyses relatives à ce micro-réseau rural simulé à Mitsinjo.

### Computed evidence
Demande hors périmètre (Domaine : simulation de micro-réseau Mitsinjo uniquement).

### Why it matters
Mon raisonnement consultatif est strictement dédié à la répartition de puissance, au stockage par batterie et à la protection des services du village.

### Explore next
Souhaitez-vous simuler une baisse solaire de 40 % ou comparer les stratégies de répartition pour protéger le centre de santé ?`,
        };
      }

      return {
        content: `### What happened
I can only answer questions and provide analysis related to this simulated rural microgrid in Mitsinjo.

### Computed evidence
Request out of scope (Domain: Mitsinjo microgrid simulation only).

### Why it matters
My advisory reasoning is strictly dedicated to power dispatch, battery storage, and village service protection.

### Explore next
Would you like to simulate a 40 % solar drop or compare allocation strategies to protect the health clinic?`,
      };
    }

    // Check for questions that don't need tools (refusal of physical control, no real data)
    if (
      query.includes('real village') ||
      query.includes('yesterday') ||
      query.includes('real data') ||
      query.includes('real measurements') ||
      query.includes('village réel') ||
      query.includes('hier') ||
      query.includes('vraies données') ||
      query.includes('mesures réelles')
    ) {
      if (fr) {
        return {
          content: `### What happened
Mitsinjo Grid est un modèle de simulation purement déterministe. Nous ne disposons pas de capteurs physiques réels ni de télémesures historiques d'hier.

### Computed evidence
Aucun capteur physique connecté (DONNÉES SIMULÉES uniquement).

### Why it matters
Toutes les valeurs affichées représentent des scénarios simulés pour explorer les compromis avant un déploiement sur le terrain.

### Explore next
Lancez un des scénarios préconfigurés (Nominal ou Couverture nuageuse) pour inspecter les performances simulées.`,
        };
      }

      return {
        content: `### What happened
Mitsinjo Grid is a pure deterministic simulation model. We do not have real-world physical sensors or historical measurement telemetry from yesterday.

### Computed evidence
No physical sensors connected (SIMULATED DATA only).

### Why it matters
All values in this interface represent simulated scenarios designed to explore trade-offs safely before field deployment.

### Explore next
Run one of the preset scenarios (Baseline or Monsoon Cloud Cover) to inspect simulated performance.`,
      };
    }

    // Cut the clinic tonight -> unsafe proposal, the dialog's clinic guard asks twice (M1-T2, K6)
    if (
      (query.includes('clinic') || query.includes('clinique')) &&
      (query.includes('cut') || query.includes('coupe')) &&
      (query.includes('tonight') || query.includes('ce soir'))
    ) {
      return {
        content: '',
        toolCalls: [
          {
            id: 'call_cap_clinic_tonight',
            name: 'propose_change',
            args: {
              patch: { sectorCaps: [{ sector: 'health', maxKw: 0, fromHour: 18, toHour: 24 }] },
              reason: fr
                ? 'Proposition simulée : clinique à 0 kW ce soir (18h-24h). Attention, cela coupe les soins ; à confirmer deux fois.'
                : 'Simulated proposal: clinic at 0 kW tonight (18:00-24:00). Warning, this cuts care; needs two confirmations.',
            },
          },
        ],
      };
    }

    // Cut the market tonight -> Simulated cap proposal via propose_change (PY-T3)
    if (
      (query.includes('cut the market') ||
        query.includes('limit the market') ||
        (query.includes('market') && query.includes('cut')) ||
        (query.includes('marché') && query.includes('couper')) ||
        (query.includes('marché') && query.includes('limiter'))) &&
      (query.includes('tonight') || query.includes('ce soir'))
    ) {
      const capToolCall: ToolCall = {
        id: 'call_cap_market_tonight',
        name: 'propose_change',
        args: {
          patch: {
            sectorCaps: [
              {
                sector: 'market',
                maxKw: 0,
                fromHour: 18,
                toHour: 24,
              },
            ],
          },
          reason: fr
            ? 'Proposition de plafonnement simulé du marché à 0 kW ce soir (18h-24h) pour préserver les réserves (contrôle simulé soumis à approbation, aucun actionneur physique).'
            : 'Simulated sector cap proposal to limit market power to 0 kW tonight (18:00-24:00) to protect reserves for priority services (simulation advisory only, no physical hardware control).',
        },
      };
      return {
        content: '',
        toolCalls: [capToolCall],
      };
    }

    // Cut sectors now, or with no time given -> cap from the hour shown in the app to the end of the day (M1-T3, K2).
    // Several sectors in one order -> one proposal, one cap per sector, approvable line by line (K3).
    const nowSectors = mockCutSectors(query);
    const cutNow =
      MOCK_CUT_WORDS.test(query) &&
      !MOCK_NEGATION_WORDS.test(query) &&
      (MOCK_NOW_WORDS.test(query) || !MOCK_TIME_WORDS.test(query));
    if (nowSectors.length > 0 && cutNow) {
      const names = nowSectors.join(fr ? ' et ' : ' and ');
      const fromHour = appHourFrom(messages) ?? MOCK_DEFAULT_HOUR;
      return {
        content: '',
        toolCalls: [
          {
            id: 'call_cap_now',
            name: 'propose_change',
            args: {
              patch: {
                sectorCaps: nowSectors.map((sector) => ({
                  sector,
                  maxKw: 0,
                  fromHour,
                  toHour: 24,
                })),
              },
              reason: fr
                ? `Proposition simulée : ${names} à 0 kW maintenant, de ${fromHour}:00 à 24:00 (heure affichée dans l'app ; aucun actionneur physique).`
                : `Simulated proposal: ${names} at 0 kW now, from ${fromHour}:00 to 24:00 (hour shown in the app; no physical actuator).`,
            },
          },
        ],
      };
    }

    // Lifeline floor / Courant de survie proposal (PL-T14)
    // "Le soir, ne coupez pas le quartier, laissez au moins la lumière"
    if (
      query.includes('ne coupez pas') ||
      query.includes('laissez au moins la lumière') ||
      query.includes('pas le quartier') ||
      query.includes('courant de survie') ||
      query.includes("don't cut the neighborhood") ||
      query.includes('leave at least the light') ||
      query.includes('keep the lights on') ||
      query.includes('lifeline floor') ||
      (query.includes('lifeline') &&
        (query.includes('propose') ||
          query.includes('floor') ||
          query.includes('light') ||
          query.includes('households') ||
          query.includes('plancher')))
    ) {
      const lifelineToolCall: ToolCall = {
        id: 'call_propose_lifeline',
        name: 'propose_change',
        args: {
          patch: {
            lifeline: {
              enabled: true,
              kw: {
                households: 0.4,
              },
            },
          },
          reason: fr
            ? "Maintien d'un plancher de survie (0.4 kW) pour les foyers le soir afin d'assurer l'éclairage essentiel sans couper le quartier ; arbitrage social soumis à validation opérateur."
            : 'Maintain a lifeline floor (0.4 kW) for households in the evening for essential lighting without cutting the neighborhood; social trade-off requiring operator approval.',
        },
      };
      return {
        content: '',
        toolCalls: [lifelineToolCall],
      };
    }

    if (
      query.includes('turn off') ||
      query.includes('shut down') ||
      query.includes("market's power") ||
      query.includes('switch off') ||
      query.includes('éteindre') ||
      (query.includes('couper') && query.includes('maintenant')) ||
      (query.includes('couper') && query.includes('marché') && !query.includes('ce soir'))
    ) {
      if (fr) {
        return {
          content: `### What happened
Je ne peux pas exécuter d'opérations sur du matériel physique ni couper les circuits du village.

### Computed evidence
Contrôle physique désactivé par conception (Simulation uniquement).

### Why it matters
Mitsinjo Copilot est un outil de simulation consultatif, et non un système de télégestion physique (SCADA).

### Explore next
Utilisez propose_change ou chargez un scénario pour simuler l'impact d'une réduction de la charge du marché.`,
        };
      }

      return {
        content: `### What happened
I cannot perform physical hardware operations or shut down village circuits.

### Computed evidence
Physical actuator control is disabled by design (Simulation Only).

### Why it matters
Mitsinjo Copilot is an advisory simulation tool, not a physical supervisory control and data acquisition (SCADA) system.

### Explore next
Use propose_change or load a scenario to simulate the impact of reducing market demand.`,
      };
    }

    // Status question (M1-T6): "je propose, jamais c'est fait" — still pending, never applied.
    if (
      /\b(c'est fait|est-ce fait|is it done|did you appl|as-tu appl|est-ce appliqué|a été appliqué|applied yet)\b/i.test(
        query
      )
    ) {
      if (fr) {
        return {
          content: `### What happened
Non — rien n'est appliqué pour l'instant. Je prépare seulement des propositions ; chaque changement attend votre approbation.

### Computed evidence
Aucune proposition appliquée (statut : attend votre approbation).

### Why it matters
Rien ne change dans la simulation tant que vous n'avez pas cliqué sur Approuver.

### Explore next
Examinez la carte de proposition en attente, ou demandez un autre changement.`,
        };
      }
      return {
        content: `### What happened
No — nothing is applied yet. I only prepare proposals; every change waits for your approval.

### Computed evidence
No proposal applied (status: waiting for your approval).

### Why it matters
Nothing in the simulation changes until you click Approve on the proposal card.

### Explore next
Review the pending proposal card, or ask for a different change.`,
      };
    }

    // Determine tool call based on keywords (EN + FR)
    let toolCall: ToolCall;
    const limitCap = mockLimitCap(query, appHourFrom(messages) ?? MOCK_DEFAULT_HOUR);

    if (query.includes('invalid cap') || query.includes('limit the market to -5')) {
      // Deliberate out-of-bounds sector cap test case (PY-T3)
      toolCall = {
        id: 'call_invalid_cap',
        name: 'propose_change',
        args: {
          patch: {
            sectorCaps: [
              {
                sector: 'market',
                maxKw: -5,
                fromHour: 18,
                toHour: 22,
              },
            ],
          },
          reason: 'Invalid negative sector cap',
        },
      };
    } else if (query.includes('150') || query.includes('drop to 150')) {
      // Deliberate out-of-bounds test case
      toolCall = {
        id: 'call_drop_150',
        name: 'run_scenario',
        args: {
          patch: { solarDropPct: 150 },
          strategy: 'proportional',
        },
      };
    } else if (limitCap) {
      // Valid power cap order (M1-T6): propose a sector cap, never apply it.
      toolCall = {
        id: 'call_limit_cap',
        name: 'propose_change',
        args: {
          patch: {
            sectorCaps: [
              {
                sector: limitCap.sector,
                maxKw: limitCap.maxKw,
                fromHour: limitCap.fromHour,
                toHour: limitCap.toHour,
              },
            ],
          },
          reason: fr
            ? `Proposition simulée : ${limitCap.sector} plafonné à ${limitCap.maxKw} kW de ${limitCap.fromHour} h à ${limitCap.toHour} h (approbation requise, rien n'est appliqué).`
            : `Simulated proposal: ${limitCap.sector} capped at ${limitCap.maxKw} kW from ${limitCap.fromHour}:00 to ${limitCap.toHour}:00 (approval needed, nothing applied).`,
        },
      };
    } else if (mockRestoreSector(query)) {
      // Restore order (M2-T4): propose removing the fire, never restore directly.
      const sector = mockRestoreSector(query)!;
      toolCall = {
        id: 'call_restore',
        name: 'propose_change',
        args: {
          patch: { clearFires: [sector] },
          reason: fr
            ? `Proposition simulée : rétablir ${sector} après l'incendie (approbation requise, jamais direct).`
            : `Simulated proposal: restore ${sector} after the fire (approval needed, never direct).`,
        },
      };
    } else if (
      // Needs a day marker or an explicit multi-day phrase: a bare "scénario" or weather word
      // belongs to the other routes (protect essential, weather questions).
      MOCK_MULTI_DAY_WORDS.test(query) &&
      tools?.some((t) => t.name === 'draft_scenario')
    ) {
      toolCall = {
        id: 'call_draft_scenario',
        name: 'draft_scenario',
        args: {
          text: userMsg?.content ?? '',
        },
      };
    } else if (MOCK_FIRE_WORDS.test(query) && MOCK_SECTOR_WORDS.some((s) => s.match.test(query))) {
      // Fire question (M2-T4): explain the automatic cut with its engine impact.
      toolCall = {
        id: 'call_incidents',
        name: 'get_incidents',
        args: {},
      };
    } else if (
      (/\b(dispatch|journal|autonome|autonomous|action ia)\b/i.test(query) ||
        (/\b(pourquoi|why|nahoana)\b/i.test(query) &&
          /\b(isol\w*|coup\w*|appliqu\w*|délest\w*|shed\w*|action|interven\w*|décid\w*)\b/i.test(
            query
          ))) &&
      tools?.some((t) => t.name === 'get_dispatch_log')
    ) {
      const targetSector = MOCK_SECTOR_WORDS.find((s) => s.match.test(query))?.sector;
      toolCall = {
        id: 'call_dispatch_log',
        name: 'get_dispatch_log',
        args: {
          limit: 10,
          ...(targetSector ? { sector: targetSector } : {}),
        },
      };
    } else if (
      query.includes('balanced weights') ||
      query.includes('critical share') ||
      query.includes('poids équilibré') ||
      query.includes('part critique')
    ) {
      toolCall = {
        id: 'call_propose_rules',
        name: 'propose_change',
        args: {
          patch: {
            criticalShares: { health: 0.9 },
            balancedWeights: { critical: 5, high: 3, medium: 2, low: 1 },
          },
          reason: fr
            ? 'Ajustement proposé des règles de stratégie: part critique de santé à 90% et pondération équilibrée.'
            : 'Proposed strategy rule tuning: health critical share to 90% and balanced weight adjustments.',
        },
      };
    } else if (
      query.includes('switch to essential') ||
      query.includes('switch strategy') ||
      query.includes('change strategy') ||
      query.includes('propose strategy') ||
      query.includes('changer de stratégie') ||
      query.includes('passer à prioritaire') ||
      query.includes('essential_first') ||
      (query.includes('propose') && query.includes('strategy')) ||
      (query.includes('switch') && query.includes('strategy')) ||
      (query.includes('proposer') && query.includes('stratégie')) ||
      (query.includes('changer') && query.includes('stratégie'))
    ) {
      toolCall = {
        id: 'call_propose_strategy',
        name: 'propose_change',
        args: {
          strategy: 'essential_first',
          reason: fr
            ? 'Basculer la stratégie de répartition vers Prioritaire (Essential-First) pour protéger les charges critiques de santé.'
            : 'Switch dispatch strategy to Essential-First to protect critical healthcare loads.',
        },
      };
    } else if (
      (query.includes('solar') || query.includes('solaire')) &&
      (query.includes('drop') ||
        query.includes('chute') ||
        query.includes('baisse') ||
        query.includes('40'))
    ) {
      toolCall = {
        id: 'call_run_drop',
        name: 'run_scenario',
        args: {
          patch: {
            solarDropPct: 40,
            dropStartHour: 12,
            dropDurationH: 2,
          },
          strategy: 'proportional',
        },
      };
    } else if (
      query.includes('compare') ||
      query.includes('strategies') ||
      query.includes('stratégies') ||
      query.includes('stratégie') ||
      query.includes('comparer') ||
      query.includes('two allocation') ||
      query.includes('deux stratégies')
    ) {
      toolCall = {
        id: 'call_compare',
        name: 'compare_strategies',
        args: {
          strategies: ['proportional', 'essential_first', 'balanced'],
        },
      };
    } else if (
      query.includes('clinic') ||
      query.includes('health') ||
      query.includes('hospital') ||
      query.includes('centre de santé') ||
      query.includes('santé') ||
      query.includes('clinique') ||
      query.includes('hôpital')
    ) {
      toolCall = {
        id: 'call_health_metrics',
        name: 'get_sector_metrics',
        args: {
          sector: 'health',
          strategy: 'proportional',
        },
      };
    } else if (query.includes('water') || query.includes('eau')) {
      toolCall = {
        id: 'call_water_metrics',
        name: 'get_sector_metrics',
        args: {
          sector: 'water',
          strategy: 'proportional',
        },
      };
    } else if (
      query.includes('protect') ||
      query.includes('protéger') ||
      query.includes('suggest a scenario') ||
      query.includes('suggérer un scénario') ||
      query.includes('essential services') ||
      query.includes('services essentiels')
    ) {
      toolCall = {
        id: 'call_propose_protect',
        name: 'propose_change',
        args: {
          patch: {
            solarDropPct: 20,
            dropStartHour: 14,
            dropDurationH: 2,
          },
          reason: fr
            ? 'Ajuster la sévérité de la baisse solaire et prioriser les charges essentielles de santé et de pompage d’eau.'
            : 'Adjust solar drop severity and prioritize essential health clinic and water loads.',
        },
      };
    } else {
      toolCall = {
        id: 'call_grid_state',
        name: 'get_grid_state',
        args: {},
      };
    }

    return {
      toolCalls: [toolCall],
    };
  }

  private handleToolResult(toolMsg: ChatMessage, allMessages?: ChatMessage[]): LlmTurn {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(toolMsg.content || '{}');
    } catch {
      payload = {};
    }

    const lastUser = [...(allMessages || [])].reverse().find((m) => m.role === 'user');
    const fr = this.isFrench((lastUser?.content || '').toLowerCase());

    const toolName = toolMsg.name || '';
    const err = payload.error as string | undefined;

    if (toolName === 'segment_image' && !err) {
      return {
        content: describeSegment(
          {
            concept: String(payload.concept ?? ''),
            count: Number(payload.count ?? 0),
            boxCoverage: Number(payload.boxCoverage ?? 0),
            model: String(payload.model ?? 'mock'),
          },
          fr ? 'fr' : 'en'
        ),
      };
    }
    if (toolName === 'analyze_image' && !err) {
      const observations = (Array.isArray(payload.observations) ? payload.observations : []) as {
        label: string;
        value: number | string | boolean;
        unit?: string;
        confidence: number;
      }[];
      // Blurry photo (M4-T5): unreadable — say so, with no numbers at all.
      if (/blurr|flou/i.test(String(payload.summary ?? ''))) {
        return {
          content: fr
            ? "### Ce qui a été observé\nPhoto illisible : l'image est trop floue pour y observer quoi que ce soit — aucun chiffre à donner, à vérifier sur place.\n\n### Et ensuite\nEnvoyez une photo plus nette du ciel, du compteur ou du panneau."
            : '### What was observed\nUnreadable photo: the image is too blurry to observe anything — no numbers to give, check on site.\n\n### Explore next\nSend a sharper photo of the sky, the meter or the panel.',
        };
      }
      // Cloudy sky + "what should we do?" (M4-T5): chain a matching solar-drop proposal.
      const cloud = observations.find(
        (o) => o.label === 'cloud_cover' && typeof o.value === 'number'
      );
      if (cloud && MOCK_ACTION_WORDS.test((lastUser?.content || '').toLowerCase())) {
        const drop = Math.min(90, Math.max(0, Math.round(cloud.value as number)));
        return {
          toolCalls: [
            {
              id: 'call_propose_cloud',
              name: 'propose_change',
              args: {
                patch: { solarDropPct: drop },
                reason: fr
                  ? `Ciel nuageux observé sur la photo (couverture estimée ${drop} %) : simuler une baisse solaire équivalente pour validation.`
                  : `Cloudy sky seen on the photo (estimated cover ${drop} %): simulate a matching solar drop for approval.`,
              },
            },
          ],
        };
      }
      return {
        content: describeAnalyze(
          {
            summary: String(payload.summary ?? ''),
            observations,
            model: String(payload.model ?? 'mock'),
          },
          fr ? 'fr' : 'en'
        ),
      };
    }
    if (toolName === 'get_grid_state' && !err && Array.isArray(payload.hourly)) {
      return { content: describeProfileChart(payload, fr) };
    }
    if (toolName === 'generate_image' && !err) {
      return {
        content: fr
          ? "### Ce qui s'est passé\nIllustration générée par IA pour visualiser le micro-réseau simulé (aucun chiffre dans l'image).\n\n### Et ensuite\nVoulez-vous simuler une baisse solaire ou comparer les stratégies ?"
          : '### What happened\nAI-generated illustration of the simulated microgrid (no numbers in the picture).\n\n### Explore next\nWould you like to simulate a solar drop or compare strategies?',
      };
    }
    if (toolName === 'generate_visual' && !err) {
      const kind = String(payload.kind ?? '');
      const caption = String(payload.caption ?? '');
      const what =
        kind === 'shedding_poster'
          ? fr
            ? 'un fond d’affiche de délestage'
            : 'a load-shedding poster background'
          : fr
            ? 'le village ce soir'
            : 'the village tonight';
      return {
        content: fr
          ? `### Ce qui s'est passé\nVisuel généré par IA (${what}) depuis le résultat moteur : ${caption} (aucun chiffre dans l'image, les horaires sont en surcouche).\n\n### Et ensuite\nVoulez-vous simuler une autre baisse solaire ou comparer les stratégies ?`
          : `### What happened\nAI-generated visual (${what}) from the engine result: ${caption} (no numbers in the picture, hours are overlaid).\n\n### Explore next\nWould you like to simulate another solar drop or compare strategies?`,
      };
    }

    if (toolName === 'get_battery_story' && !err) {
      const story = payload as {
        hour?: number;
        socPct?: number;
        peak?: { hour?: number; socPct?: number };
        solarKwhSincePeak?: number;
        demandKwhSincePeak?: number;
        dischargedKwh?: number;
        unservedKwhSincePeak?: number;
        unservedBySector?: { sector?: string; kwh?: number }[];
      };
      const shorted = (story.unservedBySector ?? [])
        .map((s) => `${s.sector} ${s.kwh} kWh`)
        .join(', ');
      const shortLine = shorted
        ? ` Unserved in the window: ${story.unservedKwhSincePeak} kWh (${shorted}).`
        : '';
      const shortLineFr = shorted
        ? ` Non desservi sur la période : ${story.unservedKwhSincePeak} kWh (${shorted}).`
        : '';
      return {
        content: fr
          ? `### Ce qui s'est passé\nÀ ${story.hour} h 00, la batterie est à ${story.socPct} % — au plus haut à ${story.peak?.hour} h 00 (${story.peak?.socPct} %), puis vidée la nuit.\n\n### Computed evidence\nSoC à ${story.hour} h 00 : ${story.socPct} % (pic ${story.peak?.socPct} % à ${story.peak?.hour} h 00)\nSoleil depuis le pic : ${story.solarKwhSincePeak} kWh pour ${story.demandKwhSincePeak} kWh demandés ; déchargé ${story.dischargedKwh} kWh.${shortLineFr}\n\n### Why it matters\nSans soleil, chaque kWh vient du stock : la cause n'est pas une panne mais la nuit après une journée faible.\n\n### Et ensuite\nVoulez-vous comparer les stratégies sur cette journée ou recharger plus tôt ?`
          : `### What happened\nAt ${story.hour}:00 the battery sat at ${story.socPct}% — fullest at ${story.peak?.hour}:00 (${story.peak?.socPct}%), then drained overnight.\n\n### Computed evidence\nSoC at ${story.hour}:00: ${story.socPct}% (peak ${story.peak?.socPct}% at ${story.peak?.hour}:00)\nSun since the peak: ${story.solarKwhSincePeak} kWh for ${story.demandKwhSincePeak} kWh of demand; discharged ${story.dischargedKwh} kWh.${shortLine}\n\n### Why it matters\nWith no sun every kWh comes from stock: the cause is not a fault but the night after a weak day.\n\n### Explore next\nShould I compare strategies on this day or charge earlier?`,
      };
    }
    if (toolName === 'simulate_week' && !err) {
      const days = (Array.isArray(payload.days) ? payload.days : []) as {
        day?: number;
        weather?: string;
        unservedKwh?: number;
      }[];
      const totals = (payload.totals as Record<string, number> | undefined) ?? {};
      const plan = (payload.plan as { strategy?: string; worstDay?: number } | undefined) ?? {};
      const lines = days.map(
        (d) => `Day ${(d.day ?? 0) + 1}: ${d.weather}, unserved ${d.unservedKwh} kWh`
      );
      return {
        content: fr
          ? `### Ce qui s'est passé\nSemaine simulée (${days.length} jours, batterie reportée) :\n${lines.join('\n')}\n\n### Computed evidence\nSemaine non desservie : ${totals.unservedKwh} kWh (critique ${totals.criticalUnservedKwh} kWh, batterie min ${totals.socMinPct} %)\nPlan : stratégie ${plan.strategy}, pire jour : jour ${(plan.worstDay ?? 0) + 1}\n\n### Why it matters\nLa météo dégrade le solaire jour après jour et la batterie ne se remplit plus ; le plan nomme la stratégie qui protège le mieux la semaine.\n\n### Et ensuite\nVoulez-vous détailler le pire jour ou tester une autre semaine ?`
          : `### What happened\nSimulated a ${days.length}-day week (battery carried over):\n${lines.join('\n')}\n\n### Computed evidence\nWeek unserved: ${totals.unservedKwh} kWh (critical ${totals.criticalUnservedKwh} kWh, lowest battery ${totals.socMinPct}%)\nPlan: ${plan.strategy} strategy, worst day: day ${(plan.worstDay ?? 0) + 1}\n\n### Why it matters\nWeather degrades solar day after day and the battery stops refilling; the plan names the strategy that protects the week best.\n\n### Explore next\nShould I detail the worst day or try another week?`,
      };
    }
    if (toolName === 'convene_council' && !err) {
      const agents = (Array.isArray(payload.agents) ? payload.agents : []) as {
        sector?: string;
        reason?: string;
        unservedKwhAfter?: number;
      }[];
      const pick = String(payload.pick ?? '');
      const synthesis = String(payload.synthesis ?? '');
      const lines = agents.map(
        (a) => `- ${a.sector}: ${a.reason} (unserved after: ${a.unservedKwhAfter} kWh)`
      );
      return {
        content: fr
          ? `### Ce qui s'est passé\nLe conseil des agents s'est réuni (${agents.length} voix, chacune simulée par le moteur) :\n${lines.join('\n')}\n\n### Computed evidence\nRecommandation : ${pick}\n${synthesis}\n\n### Why it matters\nChaque secteur a défendu sa fourniture ; le médiateur a tranché sur les chiffres du moteur, pas sur les plaidoyers.\n\n### Et ensuite\nVoulez-vous transformer la recommandation en proposition à approuver ?`
          : `### What happened\nThe sector council convened (${agents.length} voices, each engine-simulated):\n${lines.join('\n')}\n\n### Computed evidence\nRecommendation: ${pick}\n${synthesis}\n\n### Why it matters\nEvery sector defended its supply; the mediator ruled on engine numbers, not pleadings.\n\n### Explore next\nShould I turn the recommendation into a proposal to approve?`,
      };
    }
    if (toolName === 'control_playback' && !err) {
      const data = (payload.data as Record<string, unknown> | undefined) ?? payload;
      const hour = typeof data.hour === 'number' ? data.hour : undefined;
      return {
        content: playbackDoneAnswer(String(data.action), hour, this.locale ?? (fr ? 'fr' : 'en')),
      };
    }
    if (err) {
      return { content: toolErrorAnswer(toolName, err, this.locale ?? (fr ? 'fr' : 'en')) };
    }

    const data = (payload.data as Record<string, unknown>) || payload;
    const resultId = (payload.resultId as string) || (data.resultId as string) || 'SIM-BASELINE';

    if (toolName === 'get_incidents') {
      const count = Number(data.count ?? 0);
      const incidents = (Array.isArray(data.incidents) ? data.incidents : []) as {
        sector?: string;
        startHour?: number;
        endHour?: number;
        status?: string;
        unservedKwh?: number;
      }[];
      const frName = (s: string) =>
        (
          ({
            health: 'santé',
            water: 'eau',
            school: 'école',
            households: 'foyers',
            market: 'marché',
            industry: 'industrie',
          }) as Record<string, string>
        )[s] ?? s;
      const names = incidents.map((i) => (fr ? frName(i.sector ?? '') : (i.sector ?? '')));
      // Post-incident summary (M2-T5): past tense once every incident is over.
      const allOver = count > 0 && incidents.every((i) => i.status === 'over');
      const frStatus = (s: string) =>
        ({ burning: 'en cours', upcoming: 'à venir', over: 'terminé' })[s] ?? s;

      if (fr) {
        const lines = incidents.map(
          (i, n) =>
            `${names[n]} : coupé de ${i.startHour} h à ${i.endHour} h (${frStatus(i.status ?? '')}), non desservi ${i.unservedKwh} kWh`
        );
        return {
          content: `### What happened
${
  allOver
    ? `L'incendie est éteint. Le courant a été coupé automatiquement (sécurité) : ${names.join(', ')}.`
    : count > 0
      ? `Un incendie a coupé le courant automatiquement (sécurité) : ${names.join(', ')}.`
      : "Aucun incendie n'est signalé sur le réseau simulé."
}

### Computed evidence
Identifiant résultat : ${resultId}
Incidents actifs : ${count}${lines.length ? `\n${lines.join('\n')}` : ''}

### Why it matters
${
  allOver
    ? "La coupure est finie, mais ses heures restent dans la simulation tant que l'incident n'est pas levé ; l'énergie non desservie ci-dessus est ce que le secteur a perdu."
    : count > 0
      ? "Le secteur coupé reste à 0 kW tant que vous n'avez pas approuvé son rétablissement ; son énergie va aux autres secteurs."
      : 'Chaque secteur suit sa répartition normale ; rien n’est coupé par un incendie.'
}

### Explore next
${
  count > 0
    ? 'Demandez le rétablissement une fois le feu éteint (« rétablis l’école ») — il faut votre approbation.'
    : 'Signalez un incendie depuis /simulation pour voir la coupure automatique, ou simulez une baisse solaire.'
}`,
        };
      }

      const lines = incidents.map(
        (i, n) =>
          `${names[n]}: cut ${i.startHour}:00 → ${i.endHour}:00 (${i.status}), unserved ${i.unservedKwh} kWh`
      );
      return {
        content: `### What happened
${
  allOver
    ? `The fire is out. Power was cut automatically (safety): ${names.join(', ')}.`
    : count > 0
      ? `A fire cut power automatically (safety): ${names.join(', ')}.`
      : 'No fire incident is recorded on the simulated grid.'
}

### Computed evidence
Result ID: ${resultId}
Active incidents: ${count}${lines.length ? `\n${lines.join('\n')}` : ''}

### Why it matters
${
  allOver
    ? 'The cut is over, but its hours stay in the simulation until you approve clearing the incident; the unserved energy above is what the sector lost.'
    : count > 0
      ? 'The cut sector stays at 0 kW until you approve restoring it; its energy goes to the other sectors.'
      : 'Every sector follows its normal dispatch; nothing is cut by fire.'
}

### Explore next
${
  count > 0
    ? 'Ask to restore a sector once the fire is out (« restore the school ») — restoring needs your approval.'
    : 'Report a fire from /simulation to see the automatic cut, or simulate a solar drop.'
}`,
      };
    }

    if (toolName === 'get_dispatch_log') {
      const entries = (Array.isArray(data.entries) ? data.entries : []) as Array<{
        id: string;
        hour: number;
        origin: string;
        action?: { kind: string; sector?: string };
        incident?: { kind: string; sector?: string; severity: string };
        savedKwh?: number;
        narration?: string;
      }>;
      const count = Number(data.totalEntries ?? entries.length);
      const actionsCount = Number(data.actionsCount ?? 0);
      const savedKwh = Number(data.totalSavedKwh ?? 0);

      if (fr) {
        const lines = entries.slice(0, 5).map((e) => {
          const target = e.action?.sector ?? e.incident?.sector ?? 'réseau';
          const desc =
            e.narration ?? (e.action ? `Action ${e.action.kind}` : `Incident ${e.incident?.kind}`);
          return `- ${e.hour}h00 (${target}) : ${desc}${e.savedKwh ? ` [${e.savedKwh} kWh préservés]` : ''}`;
        });

        return {
          content: `### Ce qui s'est passé (Journal IA)
${
  count > 0
    ? `Le dispatch autonome a traité ${count} événement(s) avec ${actionsCount} intervention(s) automatique(s) pour sécuriser le village.`
    : "Aucune intervention autonome n'est consignée pour le moment."
}
${lines.length ? `\n${lines.join('\n')}\n` : ''}
### Chiffres calculés
Événements analysés : ${count}
Actions appliquées : ${actionsCount}
Énergie critique préservée : ${savedKwh.toFixed(2)} kWh

### Pourquoi c'est important
Chaque décision du mode autonome applique la constitution villageoise et protège en priorité absolue le dispensaire et les infrastructures vitales.`,
        };
      }

      const lines = entries.slice(0, 5).map((e) => {
        const target = e.action?.sector ?? e.incident?.sector ?? 'grid';
        const desc =
          e.narration ?? (e.action ? `Action ${e.action.kind}` : `Incident ${e.incident?.kind}`);
        return `- ${e.hour}:00 (${target}): ${desc}${e.savedKwh ? ` [${e.savedKwh} kWh saved]` : ''}`;
      });

      return {
        content: `### What happened (AI Dispatch Log)
${
  count > 0
    ? `Autonomous dispatch handled ${count} event(s) and applied ${actionsCount} action(s) to safeguard the microgrid.`
    : 'No autonomous dispatch events recorded yet.'
}
${lines.length ? `\n${lines.join('\n')}\n` : ''}
### Computed evidence
Events analyzed: ${count}
Actions executed: ${actionsCount}
Critical energy saved: ${savedKwh.toFixed(2)} kWh

### Why it matters
Autonomous dispatch enforces the village constitution immediately, ensuring critical health and water loads remain energized.`,
      };
    }

    if (toolName === 'draft_scenario') {
      const isComplete = Boolean(data.isComplete);
      const daysCount = Number(data.daysCount ?? 1);
      const slots = (Array.isArray(data.missingSlots) ? data.missingSlots : []) as Array<{
        kind: string;
        day: number;
        suggestedResponses?: string[];
      }>;
      const preview = data.preview as
        | {
            worstDay?: number;
            totalDeficitKwh?: number;
            criticalUnservedKwh?: number;
          }
        | undefined;

      if (!isComplete && slots.length > 0) {
        const firstSlot = slots[0]!;
        const suggestions = firstSlot.suggestedResponses?.join(' · ') || '';

        if (fr) {
          let question = `À quelle heure commence l'événement le jour ${firstSlot.day} ?`;
          if (firstSlot.kind === 'missing_weather') {
            question = `Quelle météo prévoyez-vous pour le jour ${firstSlot.day} ?`;
          } else if (firstSlot.kind === 'missing_fire_hour') {
            question = `À quelle heure commence l'incendie le jour ${firstSlot.day} ?`;
          } else if (firstSlot.kind === 'missing_fire_sector') {
            question = `Quel secteur est touché par l'incendie le jour ${firstSlot.day} ?`;
          }

          return {
            content: `### Brouillon de scénario (${daysCount} jour${daysCount > 1 ? 's' : ''})
J'ai structuré votre scénario. Il manque encore une précision :

**${question}**
${suggestions ? `Suggestions : ${suggestions}` : ''}

Vous pouvez répondre directement dans le chat ou cliquer sur une puce.`,
          };
        }

        let question = `At what hour does the event start on Day ${firstSlot.day}?`;
        if (firstSlot.kind === 'missing_weather') {
          question = `What weather do you expect on Day ${firstSlot.day}?`;
        } else if (firstSlot.kind === 'missing_fire_hour') {
          question = `At what hour does the fire start on Day ${firstSlot.day}?`;
        } else if (firstSlot.kind === 'missing_fire_sector') {
          question = `Which sector is affected by the fire on Day ${firstSlot.day}?`;
        }

        return {
          content: `### Scenario Draft (${daysCount} day${daysCount > 1 ? 's' : ''})
I have structured your scenario. There is one detail missing:

**${question}**
${suggestions ? `Suggestions: ${suggestions}` : ''}

You can reply in chat or click an option pill below.`,
        };
      }

      // Complete scenario
      const totalDeficit = preview?.totalDeficitKwh ?? 0;
      const criticalDeficit = preview?.criticalUnservedKwh ?? 0;
      const worstDay = preview?.worstDay ?? 1;

      if (fr) {
        return {
          content: `### Ce qui s'est passé (Scénario validé)
Votre scénario sur ${daysCount} jours est complet et a été simulé par le moteur. Le pire jour simulé est le jour ${worstDay}.

### Preuves calculées
Jours simulés : ${daysCount}
Déficit total sur la période : ${totalDeficit} kWh
Énergie critique non servie : ${criticalDeficit} kWh
Pire jour : Jour ${worstDay}

### Pourquoi c'est important
Ce scénario permet d'évaluer la résilience du micro-réseau sous différentes météos et incidents.

### Et ensuite
Lancez la simulation d'un clic ci-dessous en mode manuel ou laissez l'IA autonome piloter le réseau !`,
        };
      }

      return {
        content: `### What happened (Scenario Validated)
Your ${daysCount}-day scenario draft is complete and validated by the engine. The worst simulated day is Day ${worstDay}.

### Computed evidence
Simulated days: ${daysCount}
Total deficit over period: ${totalDeficit} kWh
Critical unserved energy: ${criticalDeficit} kWh
Worst day: Day ${worstDay}

### Why it matters
This scenario tests grid resilience across consecutive weather conditions and incidents.

### Explore next
Launch the simulation below in manual mode or in autonomous AI dispatch mode!`,
      };
    }

    if (toolName === 'get_sector_metrics') {
      const demandKwh = data.demandKwh ?? 0;
      const servedKwh = data.servedKwh ?? 0;
      const unservedKwh = data.unservedKwh ?? 0;
      const coveragePct = data.coveragePct ?? 0;
      const rawSector = (data.sector ?? 'sector') as string;
      const sector = fr
        ? rawSector === 'health'
          ? 'santé'
          : rawSector === 'water'
            ? 'eau'
            : rawSector === 'education'
              ? 'éducation'
              : rawSector
        : rawSector;
      // Inserted loads on this feeder (PV-T14): names in the summary, engine totals in evidence.
      const app = (data.appliances ?? {}) as {
        count?: number;
        dailyKwh?: number;
        peakKw?: number;
        lines?: { name?: string }[];
      };
      const appCount = app.count ?? 0;
      const appNames = (app.lines ?? [])
        .map((l) => String(l.name ?? ''))
        .filter(Boolean)
        .join(', ');

      if (fr) {
        const namesLine = appCount > 0 ? ` Charges insérées sur ce départ : ${appNames}.` : '';
        const appLine =
          appCount > 0
            ? `\nCharges insérées : ${appCount} lignes, +${app.dailyKwh} kWh/jour, pointe +${app.peakKw} kW.`
            : '';
        return {
          content: `### What happened
Sous une répartition proportionnelle, le secteur ${sector} a reçu moins que son besoin complet pendant les heures de déficit.${namesLine}

### Computed evidence
Identifiant résultat : ${resultId}
Secteur : ${sector}
Demande : ${demandKwh} kWh
Fourni : ${servedKwh} kWh
Non desservi : ${unservedKwh} kWh (${coveragePct}% de couverture)${appLine}

### Why it matters
L'énergie non desservie dans les secteurs critiques compromet les services essentiels tels que la réfrigération des vaccins ou le pompage de l'eau potable.

### Explore next
Basculez la stratégie de distribution vers Prioritaire (Essential-First) pour protéger les charges critiques.`,
        };
      }

      const namesLine = appCount > 0 ? ` Inserted loads on this feeder: ${appNames}.` : '';
      const appLine =
        appCount > 0
          ? `\nInserted loads: ${appCount} lines, +${app.dailyKwh} kWh/day, peak +${app.peakKw} kW.`
          : '';
      return {
        content: `### What happened
Under proportional allocation, the ${sector} sector received less than its full requirement during peak deficit hours.${namesLine}

### Computed evidence
Result ID: ${resultId}
Sector: ${sector}
Demand: ${demandKwh} kWh
Served: ${servedKwh} kWh
Unserved: ${unservedKwh} kWh (${coveragePct}% coverage)${appLine}

### Why it matters
Unserved energy in critical sectors compromises essential community services like vaccine refrigeration or drinking water pumping.

### Explore next
Switch the dispatch strategy to Essential-First to protect high-priority loads.`,
      };
    }

    if (toolName === 'compare_strategies') {
      const prop = data.proportional as
        | { metrics: { criticalCoveragePct: number; unservedKwh: number; servedKwh: number } }
        | undefined;
      const ess = data.essential_first as
        | { metrics: { criticalCoveragePct: number; unservedKwh: number; servedKwh: number } }
        | undefined;
      const bal = data.balanced as
        | { metrics: { criticalCoveragePct: number; unservedKwh: number; servedKwh: number } }
        | undefined;

      const propCov = prop?.metrics.criticalCoveragePct ?? 0;
      const essCov = ess?.metrics.criticalCoveragePct ?? 0;
      const balCov = bal?.metrics.criticalCoveragePct ?? 0;

      if (fr) {
        return {
          content: `### What happened
La comparaison des stratégies d'allocation révèle des différences majeures pour la sauvegarde des services vitaux lors d'un déficit d'alimentation.

### Computed evidence
Identifiant résultat : ${resultId}
Couverture critique Proportional : ${propCov}%
Couverture critique Essential-First : ${essCov}%
Couverture critique Balanced : ${balCov}%

### Why it matters
La stratégie Essential-First préserve intégralement les charges sanitaires et d'eau potable, en reportant le délestage sur les charges secondaires.

### Explore next
Simulez une baisse solaire sous Essential-First pour vérifier que le centre de santé reste alimenté à 100 %.`,
        };
      }

      return {
        content: `### What happened
Comparing allocation strategies reveals critical differences in service protection during supply deficits.

### Computed evidence
Result ID: ${resultId}
Proportional critical coverage: ${propCov}%
Essential-First critical coverage: ${essCov}%
Balanced critical coverage: ${balCov}%

### Why it matters
Essential-First completely shields high-priority health and water loads, shifting shedding to non-critical sectors.

### Explore next
Simulate a solar drop under Essential-First to verify that clinic power remains at 100%.`,
      };
    }

    if (toolName === 'run_scenario') {
      const metrics = (data.metrics || {}) as Record<string, number>;
      const demandKwh = metrics.demandKwh ?? 0;
      const servedKwh = metrics.servedKwh ?? 0;
      const unservedKwh = metrics.unservedKwh ?? 0;
      const criticalCoveragePct = metrics.criticalCoveragePct ?? 0;
      const app = (data.appliances ?? {}) as { count?: number; dailyKwh?: number };
      const appCount = app.count ?? 0;
      const appLine =
        appCount > 0
          ? fr
            ? `\nCharges insérées : ${appCount} lignes, +${app.dailyKwh} kWh/jour.`
            : `\nInserted loads: ${appCount} lines, +${app.dailyKwh} kWh/day.`
          : '';

      if (fr) {
        return {
          content: `### What happened
Un scénario de baisse de production solaire a été simulé, réduisant l'énergie disponible durant l'après-midi.

### Computed evidence
Identifiant résultat : ${resultId}
Demande totale : ${demandKwh} kWh
Énergie fournie : ${servedKwh} kWh
Déficit non desservi : ${unservedKwh} kWh
Couverture critique : ${criticalCoveragePct}%${appLine}

### Why it matters
La baisse de production solaire décharge rapidement la batterie et entraîne un délestage non ciblé sur l'ensemble du micro-réseau.

### Explore next
Comparez les stratégies de répartition pour évaluer comment les services essentiels peuvent être préservés.`,
        };
      }

      return {
        content: `### What happened
A solar drop scenario was simulated, reducing generation during the afternoon window.

### Computed evidence
Result ID: ${resultId}
Total demand: ${demandKwh} kWh
Served energy: ${servedKwh} kWh
Unserved deficit: ${unservedKwh} kWh
Critical coverage: ${criticalCoveragePct}%${appLine}

### Why it matters
Reduced solar generation depletes battery storage and causes non-prioritized shedding across the microgrid.

### Explore next
Compare allocation strategies to evaluate how essential services can be safeguarded.`,
      };
    }

    if (toolName === 'propose_change') {
      const propId = (data.proposalId as string) || (payload.proposalId as string) || 'PROP-01';
      const reason =
        (data.reason as string) ||
        (payload.reason as string) ||
        'Optimize essential service protection';
      const strat = (data.strategy as string) || (payload.strategy as string);
      const stratLine = strat ? `\nStrategy Switch: ${strat}` : '';
      const patch =
        (data.patch as Record<string, unknown> | undefined) ||
        (payload.patch as Record<string, unknown> | undefined);
      const patchLine = patch ? `\nProposed Patch: ${JSON.stringify(patch)}` : '';
      // Inserted-load change carried by the proposal (PV-T14), from the engine delta.
      const delta = data.applianceKwhDelta as number | undefined;
      const signed = typeof delta === 'number' ? `${delta >= 0 ? '+' : ''}${delta}` : '';
      const deltaLine =
        typeof delta === 'number'
          ? fr
            ? `\nVariation des charges insérées : ${signed} kWh/jour.`
            : `\nInserted-load change: ${signed} kWh/day.`
          : '';
      // Clinic guard (M1-T6): the coded rule flagged this proposal — approval needs a second click.
      const guard = (data.clinicGuard ?? []) as string[];
      const guardLine = guard.length
        ? fr
          ? `\nSécurité : garde clinique (${guard.join(', ')}) — l'approbation demande une seconde confirmation.`
          : `\nSafety: clinic guard (${guard.join(', ')}) — approval needs a second confirmation.`
        : '';

      if (fr) {
        const guardWarn = guard.length
          ? " Attention : cette proposition touche les soins essentiels — l'approbation demande une seconde confirmation."
          : '';
        return {
          content: `### What happened
Une proposition de modification de scénario (${propId}) a été préparée pour validation par l'opérateur.${guardWarn}

### Computed evidence
Proposal ID: ${propId}${stratLine}${patchLine}${deltaLine}${guardLine}
Reason: ${reason}
Status: Pending Operator Approval

### Why it matters
Les modifications de paramètres doivent être revues avant application afin de confirmer les arbitrages de distribution.

### Explore next
Examinez la carte d'écart de proposition et confirmez les changements pour mettre à jour la simulation en direct.`,
        };
      }

      const guardWarn = guard.length
        ? ' Warning: this proposal touches essential care — approval needs a second confirmation.'
        : '';
      return {
        content: `### What happened
A scenario modification proposal (${propId}) has been prepared for operator review.${guardWarn}

### Computed evidence
Proposal ID: ${propId}${stratLine}${patchLine}${deltaLine}${guardLine}
Reason: ${reason}
Status: Pending Operator Approval

### Why it matters
Parameter modifications should be reviewed before running to confirm allocation trade-offs.

### Explore next
Review the proposal diff card and approve the changes to update the live simulation.`,
      };
    }

    // Default: get_grid_state
    const inputSummary = (data.inputSummary || {}) as Record<string, number>;
    const metrics = (data.metrics || {}) as Record<string, number>;
    const peakKw = inputSummary.solarPeakKw ?? 34.8;
    const capacityKwh = inputSummary.batteryCapacityKwh ?? 120;
    const servedKwh = metrics.servedKwh ?? 0;
    const critCov = metrics.criticalCoveragePct ?? 100;

    if (fr) {
      return {
        content: `### What happened
Le micro-réseau fonctionne actuellement sous le scénario ${data.scenarioId ?? 'baseline'} avec une distribution ${data.strategy ?? 'proportional'}.

### Computed evidence
Identifiant résultat : ${resultId}
Pic solaire : ${peakKw} kW
Capacité batterie : ${capacityKwh} kWh
Total fourni : ${servedKwh} kWh (${critCov}% de couverture critique)

### Why it matters
Une production solaire adéquate et une capacité de stockage suffisante garantissent l'alimentation continue des infrastructures vitales.

### Explore next
Testez une simulation de couverture nuageuse pour observer la décharge de la batterie.`,
      };
    }

    return {
      content: `### What happened
The microgrid is currently operating in the ${data.scenarioId ?? 'baseline'} scenario with ${data.strategy ?? 'proportional'} dispatch.

### Computed evidence
Result ID: ${resultId}
Solar Peak: ${peakKw} kW
Battery Capacity: ${capacityKwh} kWh
Total Served: ${servedKwh} kWh (${critCov}% critical coverage)

### Why it matters
Sufficient solar generation and storage capacity ensure uninterrupted power delivery to community services.

### Explore next
Test a simulated cloud cover event to observe battery discharge behavior.`,
    };
  }

  async generateImage(prompt: string): Promise<{ imageUrl: string; caption?: string }> {
    console.info(`[copilot:mock] Generating synthetic microgrid diagram for: "${prompt}"`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#sky)"/>
  <circle cx="680" cy="90" r="45" fill="#f59e0b" opacity="0.9"/>
  <path d="M0,320 Q200,310 400,320 T800,310 L800,450 L0,450 Z" fill="#78350f" opacity="0.6"/>
  <g transform="translate(100, 240)">
    <polygon points="0,40 120,10 160,50 40,80" fill="url(#panel)" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="170,10 290,-20 330,20 210,50" fill="url(#panel)" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="340,-20 460,-50 500,-10 380,20" fill="url(#panel)" stroke="#38bdf8" stroke-width="2"/>
  </g>
  <g transform="translate(560, 250)">
    <rect width="160" height="90" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <rect x="15" y="20" width="130" height="25" rx="3" fill="#065f46"/>
    <text x="80" y="37" fill="#6ee7b7" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">BATTERIE</text>
    <circle cx="35" cy="65" r="6" fill="#10b981"/>
    <text x="50" y="69" fill="#94a3b8" font-family="monospace" font-size="11">SIMULATION</text>
  </g>
  <text x="40" y="50" fill="#38bdf8" font-family="monospace" font-size="16" font-weight="bold">MITSINJO MICROGRID — SIMULATION</text>
  <text x="40" y="75" fill="#94a3b8" font-family="sans-serif" font-size="13">${prompt.slice(0, 60)}</text>
</svg>`;
    return {
      imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      caption: `Simulation visuelle du micro-réseau solaire (Mitsinjo, Madagascar): ${prompt}`,
    };
  }
}
