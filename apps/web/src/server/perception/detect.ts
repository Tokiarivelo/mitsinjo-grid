import {
  APPLIANCE_CATEGORIES,
  ApplianceCategorySchema,
  type ApplianceCategory,
} from '@mitsinjo/engine';
import { z } from 'zod';
import { SCENERY_TYPES, SceneryTypeSchema, type SceneryType } from '@/lib/vision';
import type { ApplianceDetection } from './schemas';

/** Most detections kept from one photo (the UI lists them all). */
export const MAX_DETECTIONS = 20;

/** Muse Spark grounding grid: boxes come as integers 0–1000, top-left origin. */
const GRID = 1000;

export const DETECT_SYSTEM_PROMPT = [
  'You outline objects on a photo for the operator of a SIMULATED rural solar microgrid.',
  'List up to 20 notable objects, electrical appliances first. For each: a short label;',
  'kind "appliance" with a category from the enum (street lights and lamp posts are "lamp", other if no category fits),',
  'or kind "scenery" for things without a plug (buildings, vehicles, trees, plants, people, animals, water) with a scenery type;',
  'and bbox [x_min, y_min, x_max, y_max] on a 0-1000 grid, origin top-left.',
  'Omit what you cannot see. Never give watts, kW or any energy value. Nothing visible → empty list.',
].join(' ');

export const DETECT_JSON_SCHEMA = {
  name: 'ApplianceDetections',
  schema: {
    type: 'object',
    properties: {
      objects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            kind: { type: 'string', enum: ['appliance', 'scenery'] },
            category: { type: 'string', enum: [...APPLIANCE_CATEGORIES] },
            scenery: { type: 'string', enum: [...SCENERY_TYPES] },
            bbox: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
            confidence: { type: 'number' },
          },
          required: ['label', 'kind', 'bbox'],
        },
      },
    },
    required: ['objects'],
  },
};

const ReplySchema = z.object({ objects: z.array(z.unknown()) });

const normKey = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/** Words a model may print instead of the enum value. */
const CATEGORY_ALIASES: Record<string, ApplianceCategory> = {
  refrigerator: 'fridge',
  vaccine_fridge: 'fridge_vaccine',
  television: 'tv',
  light: 'lamp',
  bulb: 'lamp',
  light_bulb: 'lamp',
  street_light: 'lamp',
  street_lamp: 'lamp',
  lamp_post: 'lamp',
  ceiling_fan: 'fan',
  charger: 'phone_charger',
  pump: 'water_pump',
  desktop: 'computer',
  pc: 'computer',
};

const SCENERY_ALIASES: Record<string, SceneryType> = {
  house: 'building',
  home: 'building',
  shop: 'building',
  roof: 'building',
  wall: 'building',
  car: 'vehicle',
  truck: 'vehicle',
  bus: 'vehicle',
  van: 'vehicle',
  bicycle: 'vehicle',
  bike: 'vehicle',
  motorcycle: 'vehicle',
  bush: 'plant',
  shrub: 'plant',
  flower: 'plant',
  flowers: 'plant',
  hedge: 'plant',
  grass: 'plant',
  man: 'person',
  woman: 'person',
  child: 'person',
  people: 'person',
  dog: 'animal',
  cat: 'animal',
  cow: 'animal',
  zebu: 'animal',
  chicken: 'animal',
  river: 'water',
  pond: 'water',
  lake: 'water',
};

/** Appliance enum value for a model category; unknown → `other`. */
export function toApplianceCategory(raw: unknown): ApplianceCategory {
  if (typeof raw !== 'string') return 'other';
  const key = normKey(raw);
  const direct = ApplianceCategorySchema.safeParse(key);
  if (direct.success) return direct.data;
  return CATEGORY_ALIASES[key] ?? 'other';
}

function sceneryWord(word: string): SceneryType | null {
  const direct = SceneryTypeSchema.safeParse(word);
  if (direct.success && word !== 'other') return direct.data;
  return SCENERY_ALIASES[word] ?? SCENERY_ALIASES[word.replace(/s$/, '')] ?? null;
}

/** Scenery type for a model word or label (« Willow tree », « blue car »); null when it is not one. */
export function toSceneryType(raw: unknown): SceneryType | null {
  if (typeof raw !== 'string') return null;
  const key = normKey(raw);
  if (key === 'other') return 'other';
  const whole = sceneryWord(key);
  if (whole) return whole;
  // Head noun usually comes last: « stone house », « willow tree ».
  for (const word of key.split('_').reverse()) {
    const hit = sceneryWord(word);
    if (hit) return hit;
  }
  return null;
}

const clampGrid = (v: number) => Math.min(GRID, Math.max(0, v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** `[x1,y1,x2,y2]` or `{x_min,y_min,x_max,y_max}` / `{x1,y1,x2,y2}` → 4 numbers, or null. */
function bboxNumbers(raw: unknown): [number, number, number, number] | null {
  if (Array.isArray(raw)) {
    return raw.length === 4 && raw.every(isNum) ? (raw as [number, number, number, number]) : null;
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const v = [
      o.x_min ?? o.x1 ?? o.xmin,
      o.y_min ?? o.y1 ?? o.ymin,
      o.x_max ?? o.x2 ?? o.xmax,
      o.y_max ?? o.y2 ?? o.ymax,
    ];
    return v.every(isNum) ? (v as [number, number, number, number]) : null;
  }
  return null;
}

/** 0–1000 bbox → image fractions; null when unreadable or empty after clamping. */
export function gridBoxToNorm(raw: unknown): ApplianceDetection['box'] | null {
  const n = bboxNumbers(raw);
  if (!n) return null;
  const [a, b, c, d] = n.map(clampGrid) as [number, number, number, number];
  const x1 = Math.min(a, c);
  const x2 = Math.max(a, c);
  const y1 = Math.min(b, d);
  const y2 = Math.max(b, d);
  if (x2 - x1 <= 0 || y2 - y1 <= 0) return null;
  return { x: x1 / GRID, y: y1 / GRID, w: (x2 - x1) / GRID, h: (y2 - y1) / GRID };
}

/** Confidence printed as 0–1 or 0–100 → 0–1; anything else → undefined. */
function toConfidence(raw: unknown): number | undefined {
  if (!isNum(raw) || raw < 0) return undefined;
  return Math.min(1, raw > 1 ? raw / 100 : raw);
}

/** Models sometimes wrap JSON in a ```json fence despite the schema. */
function stripFence(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1]! : text;
}

/** Appliance or scenery, from `kind` when given, else from what the category / scenery words say. */
function classify(
  obj: Record<string, unknown>
): { kind: 'appliance'; category: ApplianceCategory } | { kind: 'scenery'; scenery: SceneryType } {
  const fromCategory = toApplianceCategory(obj.category);
  // A label like « Water pump » names an appliance even without a category.
  const category = fromCategory === 'other' ? toApplianceCategory(obj.label) : fromCategory;
  const scenery =
    toSceneryType(obj.scenery) ?? toSceneryType(obj.category) ?? toSceneryType(obj.label);
  if (obj.kind === 'scenery' || (obj.kind !== 'appliance' && category === 'other' && scenery)) {
    return { kind: 'scenery', scenery: scenery ?? 'other' };
  }
  return { kind: 'appliance', category };
}

/**
 * Muse Spark reply → detections, appliances first. Throws when the reply is not the expected JSON
 * (the client then falls back); skips single malformed objects.
 */
export function parseDetections(content: string): ApplianceDetection[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(content));
  } catch {
    throw new Error('Appliance detection reply is not valid JSON');
  }
  const { objects } = ReplySchema.parse(json);

  const appliances: Omit<ApplianceDetection, 'id'>[] = [];
  const scenery: Omit<ApplianceDetection, 'id'>[] = [];
  let dropped = 0;
  for (const raw of objects) {
    if (!raw || typeof raw !== 'object') {
      dropped += 1;
      continue;
    }
    const obj = raw as Record<string, unknown>;
    const box = gridBoxToNorm(obj.bbox ?? obj.box ?? obj.box_2d);
    if (!box) {
      dropped += 1;
      continue;
    }
    const c = classify(obj);
    const fallbackLabel = c.kind === 'appliance' ? c.category : c.scenery;
    const label =
      (typeof obj.label === 'string' ? obj.label.trim().slice(0, 40) : '') || fallbackLabel;
    const confidence = toConfidence(obj.confidence);
    const base = { label, box, ...(confidence !== undefined ? { confidence } : {}) };
    if (c.kind === 'appliance') appliances.push({ ...base, category: c.category });
    else scenery.push({ ...base, kind: 'scenery', category: 'other', scenery: c.scenery });
  }
  if (dropped > 0) {
    console.warn(`[vision] dropped ${dropped} of ${objects.length} objects (no readable bbox)`);
  }
  return [...appliances, ...scenery]
    .slice(0, MAX_DETECTIONS)
    .map((d, i) => ({ id: `det-${i + 1}`, ...d }));
}
