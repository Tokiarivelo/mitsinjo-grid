import {
  APPLIANCE_CATEGORIES,
  ApplianceCategorySchema,
  type ApplianceCategory,
} from '@mitsinjo/engine';
import { z } from 'zod';
import type { ApplianceDetection } from './schemas';

/** Most detections kept from one photo (the UI lists them all). */
export const MAX_DETECTIONS = 20;

/** Muse Spark grounding grid: boxes come as integers 0–1000, top-left origin. */
const GRID = 1000;

export const DETECT_SYSTEM_PROMPT = [
  'You find electrical appliances on a photo for the operator of a SIMULATED rural solar microgrid.',
  'List each visible appliance once: a short label, one category from the enum (other if none fits)',
  'and bbox [x_min, y_min, x_max, y_max] on a 0-1000 grid, origin top-left.',
  'Omit what you cannot see. Never give watts, kW or any energy value. No appliance → empty list.',
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
            category: { type: 'string', enum: [...APPLIANCE_CATEGORIES] },
            bbox: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
            confidence: { type: 'number' },
          },
          required: ['label', 'category', 'bbox'],
        },
      },
    },
    required: ['objects'],
  },
};

const ReplySchema = z.object({ objects: z.array(z.unknown()) });

/** Words a model may print instead of the enum value. */
const CATEGORY_ALIASES: Record<string, ApplianceCategory> = {
  refrigerator: 'fridge',
  vaccine_fridge: 'fridge_vaccine',
  television: 'tv',
  light: 'lamp',
  bulb: 'lamp',
  light_bulb: 'lamp',
  ceiling_fan: 'fan',
  charger: 'phone_charger',
  pump: 'water_pump',
  desktop: 'computer',
  pc: 'computer',
};

/** Enum value for a model category; unknown → `other`. */
export function toApplianceCategory(raw: unknown): ApplianceCategory {
  if (typeof raw !== 'string') return 'other';
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const direct = ApplianceCategorySchema.safeParse(key);
  if (direct.success) return direct.data;
  return CATEGORY_ALIASES[key] ?? 'other';
}

const clampGrid = (v: number) => Math.min(GRID, Math.max(0, v));

/** 0–1000 bbox → image fractions; null when not 4 finite numbers or empty after clamping. */
export function gridBoxToNorm(raw: unknown): ApplianceDetection['box'] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  if (!raw.every((v): v is number => typeof v === 'number' && Number.isFinite(v))) return null;
  const [a, b, c, d] = raw.map(clampGrid) as [number, number, number, number];
  const x1 = Math.min(a, c);
  const x2 = Math.max(a, c);
  const y1 = Math.min(b, d);
  const y2 = Math.max(b, d);
  if (x2 - x1 <= 0 || y2 - y1 <= 0) return null;
  return { x: x1 / GRID, y: y1 / GRID, w: (x2 - x1) / GRID, h: (y2 - y1) / GRID };
}

/** Confidence printed as 0–1 or 0–100 → 0–1; anything else → undefined. */
function toConfidence(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return undefined;
  return Math.min(1, raw > 1 ? raw / 100 : raw);
}

/** Models sometimes wrap JSON in a ```json fence despite the schema. */
function stripFence(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1]! : text;
}

/**
 * Muse Spark reply → detections. Throws when the reply is not the expected JSON (the client then
 * falls back); skips single malformed objects.
 */
export function parseDetections(content: string): ApplianceDetection[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(content));
  } catch {
    throw new Error('Appliance detection reply is not valid JSON');
  }
  const { objects } = ReplySchema.parse(json);

  const out: ApplianceDetection[] = [];
  for (const raw of objects) {
    if (out.length >= MAX_DETECTIONS) break;
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const box = gridBoxToNorm(obj.bbox);
    if (!box) continue;
    const category = toApplianceCategory(obj.category);
    const label = (typeof obj.label === 'string' ? obj.label.trim().slice(0, 40) : '') || category;
    const confidence = toConfidence(obj.confidence);
    out.push({
      id: `det-${out.length + 1}`,
      label,
      category,
      ...(confidence !== undefined ? { confidence } : {}),
      box,
    });
  }
  return out;
}
