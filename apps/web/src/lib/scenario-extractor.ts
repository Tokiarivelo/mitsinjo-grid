import {
  type WeatherId,
  type SectorId,
  type ScenarioDraft,
  type ScenarioDraftDay,
  type ScenarioDraftEvent,
  missingSlots,
} from './scenario-draft';

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
    /\b(orage|orageux|tempete|storm|stormy|thunderstorm|oram-baratra|orambaratra|oram baratra)\b/,
  ],
  ['rainy', /\b(pluvieux|pluie|pluie battante|rainy|rain|manorana|orana)\b/],
  ['cloudy', /\b(nuageux|nuages|couvert|cloudy|overcast|rahona|mandrahona)\b/],
  [
    'partly_cloudy',
    /\b(partly cloudy|eclaircie|eclaircies|miovaova|rahona vitsy|rahona sy masoandro)\b/,
  ],
  [
    'sunny',
    /\b(beau temps|ensoleille|soleil|sunny|clear|fair|masoandro|tsara andro|maina|matsilo)\b/,
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

/**
 * Splits input text into day segments based on day markers:
 * "jour 1", "day 1", "andro 1", "j1", "d1", "a1"
 */
function splitByDays(normText: string): Array<{ day: number; text: string }> {
  const dayMarkerRegex = /(?:\b(?:jour|day|andro)\s*([1-7])\b|\b[jda]([1-7])\b)/g;
  const matches = [...normText.matchAll(dayMarkerRegex)];

  if (matches.length === 0) return [];

  const segments: Array<{ day: number; text: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const day = parseInt(cur[1] || cur[2] || '1', 10);
    const startIdx = cur.index! + cur[0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1]!.index! : normText.length;
    const dayText = normText.substring(startIdx, endIdx);
    segments.push({ day, text: dayText });
  }

  return segments;
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

    const slots = missingSlots(nextDraft);
    if (slots.length > 0) {
      const targetSlot = slots[0]!;
      const targetDay = nextDraft.days.find((d) => d.day === targetSlot.day);
      if (targetDay) {
        if (targetSlot.kind === 'missing_weather') {
          const w = extractWeather(norm);
          if (w) targetDay.weather = w;
        } else if (targetSlot.kind === 'missing_fire_hour') {
          const h = extractHour(norm);
          if (h !== undefined) {
            const ev = targetDay.events?.[targetSlot.eventIndex ?? 0];
            if (ev && ev.type === 'fire') ev.startHour = h;
          }
        } else if (targetSlot.kind === 'missing_fire_sector') {
          const s = extractSector(norm);
          if (s) {
            const ev = targetDay.events?.[targetSlot.eventIndex ?? 0];
            if (ev && ev.type === 'fire') ev.sector = s;
          }
        } else if (targetSlot.kind === 'missing_spike_factor') {
          const factorMatch = norm.match(/[x×]\s*([1-3](?:\.[0-9]+)?)/);
          if (factorMatch && factorMatch[1]) {
            const f = parseFloat(factorMatch[1]);
            const ev = targetDay.events?.[targetSlot.eventIndex ?? 0];
            if (ev && ev.type === 'demand_spike') ev.factor = f;
          }
        } else if (targetSlot.kind === 'missing_drop_pct') {
          const dropMatch = norm.match(/([0-9]{1,2})\s*%/);
          if (dropMatch && dropMatch[1]) {
            const dp = parseInt(dropMatch[1], 10);
            const ev = targetDay.events?.[targetSlot.eventIndex ?? 0];
            if (ev && ev.type === 'solar_drop') ev.dropPct = dp;
          }
        }
      }
    }
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

  // If no day markers were found at all and no existing draft, try to create at least a Day 1 from text
  if (days.length === 0) {
    const weather = extractWeather(norm);
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
      days: Array.from(dayMap.values()).sort((a, b) => a.day - b.day),
    };
  }

  return {
    title: `Scenario (${days.length} days)`,
    days,
  };
}
