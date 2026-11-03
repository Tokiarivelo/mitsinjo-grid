import {
  type WeatherId,
  type SectorId,
  type ScenarioDraft,
  type ScenarioDraftDay,
  type ScenarioDraftEvent,
  type MissingSlot,
  DRAFT_DEFAULTS,
  missingSlots,
} from './scenario-draft';
import { MAX_WORKFLOW_DAYS } from '@mitsinjo/engine';

/**
 * Deterministic Scenario Draft Extractor (PA-T8c).
 * Offline, rule-based extraction for multi-day scenarios from natural text in FR, EN, MG.
 * Supports incremental refinement (merging with an existing draft when the user answers a question).
 */

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics: école -> ecole
    .replace(/['’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const WEATHER_PATTERNS: Array<[WeatherId, RegExp]> = [
  [
    'storm',
    /\b(orage|orageux|orageuse|tempete|storm|stormy|thunderstorm|oram-baratra|orambaratra|oram baratra)\b/,
  ],
  ['rainy', /\b(pluvieux|pluvieuse|pluie|pluie battante|rainy|rain|manorana|orana)\b/],
  ['cloudy', /\b(nuageux|nuageuse|nuages|couvert|cloudy|overcast|rahona|mandrahona)\b/],
  [
    'partly_cloudy',
    /\b(partly cloudy|eclaircie|eclaircies|miovaova|rahona vitsy|rahona sy masoandro)\b/,
  ],
  [
    'sunny',
    /\b(beau temps|ensoleille|ensoleillee|soleil|sunny|clear|fair|masoandro|tsara andro|maina|matsilo)\b/,
  ],
];

const SECTOR_PATTERNS: Array<[SectorId, RegExp]> = [
  ['school', /\b(ecole|school|sekoly|classe)\b/],
  [
    'health',
    /\b(dispensaire|hopital|hopitaly|clinic|health|pitsaboana|dokotera|centre de sante)\b/,
  ],
  ['market', /\b(marche|market|tsena|magasin)\b/],
  ['water', /\b(eau|pompe|water|pump|paompy|rano|forage|puits)\b/],
  ['households', /\b(menages|households|homes|tokantrano|fianakaviana|foyer|foyers)\b/],
  ['industry', /\b(atelier|workshop|industrie|industry|orinasa|moulin|usine)\b/],
];

const FIRE_PATTERN =
  /\b(en feu|feu|incendie|brule|fire|burning|blaze|afo|may|hain-trano|haintrano)\b/;
const SPIKE_PATTERN =
  /\b(pic|surconsommation|hausse|surge|spike|overload|fiakaran\w*|be loatra|fanjifana\w*)\b/;
const DROP_PATTERN =
  /\b(baisse solaire|chute solaire|solar drop|drop|rahona tampoka|latsaka ny masoandro)\b/;

const HOUR_PATTERN = /\b([0-2]?[0-9])\s*(?:h\b|:00|am\b|pm\b|ora\b)/;

function extractHour(text: string): number | undefined {
  const match = text.match(HOUR_PATTERN);
  if (match && match[1] !== undefined) {
    const val = parseInt(match[1], 10);
    if (val >= 0 && val <= 23) return val;
  }
  // Alternate: "à 14", "at 14", "amin'ny 14"
  const alt = text.match(/\b(?:a|at|amin'ny|amin ny)\s+([0-2]?[0-9])\b/);
  if (alt && alt[1] !== undefined) {
    const val = parseInt(alt[1], 10);
    if (val >= 0 && val <= 23) return val;
  }
  return undefined;
}

function extractWeather(text: string): WeatherId | undefined {
  for (const [wId, regex] of WEATHER_PATTERNS) {
    if (regex.test(text)) return wId;
  }
  return undefined;
}

function extractSector(text: string): SectorId | undefined {
  for (const [sId, regex] of SECTOR_PATTERNS) {
    if (regex.test(text)) return sId;
  }
  return undefined;
}

function extractEvents(text: string): ScenarioDraftEvent[] {
  const events: ScenarioDraftEvent[] = [];
  const hour = extractHour(text);
  const sector = extractSector(text);

  if (FIRE_PATTERN.test(text)) {
    events.push({
      type: 'fire',
      ...(sector ? { sector } : {}),
      ...(hour !== undefined ? { startHour: hour } : {}),
    });
  }

  if (SPIKE_PATTERN.test(text)) {
    // Check factor: e.g. "x1.5", "+50%", "1.4"
    let factor: number | undefined = undefined;
    const factorMatch = text.match(/[x×]\s*([1-3](?:\.[0-9]+)?)/);
    if (factorMatch && factorMatch[1]) {
      factor = parseFloat(factorMatch[1]);
    } else {
      const pctMatch = text.match(/\+\s*([0-9]{2,3})\s*%/);
      if (pctMatch && pctMatch[1]) {
        factor = 1 + parseInt(pctMatch[1], 10) / 100;
      }
    }

    events.push({
      type: 'demand_spike',
      sector: sector ?? 'households',
      ...(factor !== undefined ? { factor } : {}),
      ...(hour !== undefined ? { startHour: hour } : {}),
    });
  }

  if (DROP_PATTERN.test(text)) {
    let dropPct: number | undefined = undefined;
    const dropMatch = text.match(/-?\s*([0-9]{1,2})\s*%/);
    if (dropMatch && dropMatch[1]) {
      dropPct = parseInt(dropMatch[1], 10);
    }
    events.push({
      type: 'solar_drop',
      ...(dropPct !== undefined ? { dropPct } : {}),
      ...(hour !== undefined ? { startHour: hour } : {}),
    });
  }

  return events;
}

/** Ordinal words → day number (FR, EN, MG), already lower-case and without accents. */
const ORDINAL_WORDS: Record<string, number> = {
  premier: 1,
  premiere: 1,
  first: 1,
  voalohany: 1,
  deuxieme: 2,
  second: 2,
  seconde: 2,
  faharoa: 2,
  troisieme: 3,
  third: 3,
  fahatelo: 3,
  quatrieme: 4,
  fourth: 4,
  fahefatra: 4,
  cinquieme: 5,
  fifth: 5,
  fahadimy: 5,
  sixieme: 6,
  sixth: 6,
  fahenina: 6,
  septieme: 7,
  seventh: 7,
  fahafito: 7,
};
const ORDINAL_ALT = Object.keys(ORDINAL_WORDS).join('|');

/**
 * Day markers, in order of the capture groups:
 * 1. "jour 2", "journee 2", "day 2", "andro 2"
 * 2. "j2", "d2", "a2"
 * 3. "2e jour", "2eme journee", "2nd day", "3rd day" (singular noun, so "7 jours" is not day 7)
 * 4. "deuxieme jour", "second day"
 * 5. "andro faharoa" (MG: noun before the ordinal)
 */
const DAY_MARKER_REGEX = new RegExp(
  '\\b(?:jour(?:nee?)?|day|andro)\\s*([1-7])\\b' +
    '|\\b[jda]([1-7])\\b' +
    '|\\b([1-7])\\s*(?:er|ere|eme|e|nd|st|rd|th)\\s*(?:jour(?:nee?)?|day)\\b' +
    `|\\b(${ORDINAL_ALT})\\s+(?:jour(?:nee?)?|day)\\b` +
    `|\\bandro\\s+(?:faha)?(${ORDINAL_ALT})\\b`,
  'g'
);

/**
 * Splits input text into day segments based on day markers (see `DAY_MARKER_REGEX`).
 * Each segment is the text after its marker, up to the next marker.
 */
function splitByDays(normText: string): Array<{ day: number; text: string }> {
  const matches = [...normText.matchAll(DAY_MARKER_REGEX)];

  if (matches.length === 0) return [];

  const segments: Array<{ day: number; text: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const digit = cur[1] || cur[2] || cur[3];
    const word = cur[4] || cur[5];
    const day = digit ? parseInt(digit, 10) : (ORDINAL_WORDS[word ?? ''] ?? 1);
    const startIdx = cur.index! + cur[0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1]!.index! : normText.length;
    const dayText = normText.substring(startIdx, endIdx);
    segments.push({ day, text: dayText });
  }

  return segments;
}

/**
 * Total length the user wrote: "2 jours", "5 days", "3 andro". Capped at MAX_WORKFLOW_DAYS;
 * undefined when the text names no length (no implicit default such as a week).
 */
export function extractTotalDays(normText: string): number | undefined {
  const m = normText.match(/\b([1-9])\s*(?:jours|journees|days|andro)\b/);
  if (m && m[1]) return Math.min(parseInt(m[1], 10), MAX_WORKFLOW_DAYS);
  return undefined;
}

/**
 * Makes the draft run from day 1 to the length the user said, or else to the last day mentioned
 * ("jour 3 incendie" → 3 days). Gaps get `fill` (sunny unless the user gave one weather for all).
 */
function padDays(
  days: ScenarioDraftDay[],
  total: number | undefined,
  fill: WeatherId = DRAFT_DEFAULTS.weather
): ScenarioDraftDay[] {
  const lastMentioned = days.reduce((max, d) => Math.max(max, d.day), 0);
  const end = Math.min(Math.max(total ?? 0, lastMentioned), MAX_WORKFLOW_DAYS);
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (let day = 1; day <= end; day++) {
    if (!byDay.has(day)) byDay.set(day, { day, weather: fill });
  }
  return Array.from(byDay.values()).sort((a, b) => a.day - b.day);
}

/** Fills one missing slot from a free-text answer; returns true when it found a value. */
function fillSlotFromAnswer(day: ScenarioDraftDay, slot: MissingSlot, norm: string): boolean {
  const ev = slot.eventIndex !== undefined ? day.events?.[slot.eventIndex] : undefined;
  switch (slot.kind) {
    case 'missing_weather': {
      const w = extractWeather(norm);
      if (!w) return false;
      day.weather = w;
      return true;
    }
    case 'missing_fire_hour':
    case 'missing_drop_hour': {
      const h = extractHour(norm);
      if (h === undefined || !ev || (ev.type !== 'fire' && ev.type !== 'solar_drop')) return false;
      ev.startHour = h;
      return true;
    }
    case 'missing_fire_sector': {
      const sec = extractSector(norm);
      if (!sec || !ev || ev.type !== 'fire') return false;
      ev.sector = sec;
      return true;
    }
    case 'missing_spike_factor': {
      const m = norm.match(/[x×]\s*([1-3](?:\.[0-9]+)?)/);
      if (!m || !m[1] || !ev || ev.type !== 'demand_spike') return false;
      ev.factor = parseFloat(m[1]);
      return true;
    }
    case 'missing_drop_pct': {
      const m = norm.match(/([0-9]{1,2})\s*%/);
      if (!m || !m[1] || !ev || ev.type !== 'solar_drop') return false;
      ev.dropPct = parseInt(m[1], 10);
      return true;
    }
    default:
      return false;
  }
}

/**
 * Extracts a ScenarioDraft from free-form user message.
 * When `existingDraft` is provided, merges new or answered slots incrementally.
 */
export function extractScenarioDraft(text: string, existingDraft?: ScenarioDraft): ScenarioDraft {
  const norm = normalizeText(text);
  const segments = splitByDays(norm);

  // If no day markers found and existing draft is supplied, this is likely an answer to a question (e.g. "14h" or "à l'école")
  if (segments.length === 0 && existingDraft && existingDraft.days.length > 0) {
    const nextDraft: ScenarioDraft = {
      ...existingDraft,
      days: existingDraft.days.map((d) => ({
        ...d,
        events: d.events?.map((e) => ({ ...e })),
      })),
    };

    // An answer can fill several slots of the day being asked about ("centre de santé à 14h").
    const slots = missingSlots(nextDraft);
    const targetDayNo = slots[0]?.day;
    const targetDay = nextDraft.days.find((d) => d.day === targetDayNo);
    if (targetDay) {
      for (const slot of slots) {
        if (slot.day === targetDayNo) fillSlotFromAnswer(targetDay, slot, norm);
      }
    }
    nextDraft.days = padDays(nextDraft.days, extractTotalDays(norm));
    return nextDraft;
  }

  // Build draft from segments
  const days: ScenarioDraftDay[] = segments.map(({ day, text: segText }) => {
    const weather = extractWeather(segText);
    const events = extractEvents(segText);

    return {
      day,
      ...(weather ? { weather } : {}),
      ...(events.length > 0 ? { events } : {}),
    };
  });

  const totalDays = extractTotalDays(norm);

  // No day markers: the text describes the whole span ("2 jours pluvieux" → 2 rainy days),
  // events go on day 1.
  let fillWeather: WeatherId | undefined;
  if (days.length === 0) {
    const weather = extractWeather(norm);
    fillWeather = weather;
    const events = extractEvents(norm);
    days.push({
      day: 1,
      ...(weather ? { weather } : {}),
      ...(events.length > 0 ? { events } : {}),
    });
  }

  // Merge with existing draft if present
  if (existingDraft && existingDraft.days.length > 0) {
    const dayMap = new Map<number, ScenarioDraftDay>();
    for (const d of existingDraft.days) {
      dayMap.set(d.day, { ...d, events: d.events?.map((e) => ({ ...e })) });
    }
    for (const d of days) {
      const prev = dayMap.get(d.day);
      if (prev) {
        dayMap.set(d.day, {
          day: d.day,
          weather: d.weather ?? prev.weather,
          events: d.events && d.events.length > 0 ? d.events : prev.events,
        });
      } else {
        dayMap.set(d.day, d);
      }
    }
    return {
      ...existingDraft,
      days: padDays(
        Array.from(dayMap.values()).sort((a, b) => a.day - b.day),
        totalDays,
        fillWeather
      ),
    };
  }

  // No title: the UI names the draft in the user's language from its day count.
  return { days: padDays(days, totalDays, fillWeather) };
}
