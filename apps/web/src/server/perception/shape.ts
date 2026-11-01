import type { ApplianceCategory } from '@mitsinjo/engine';
import type { SceneryType } from '@/lib/vision';
import { z } from 'zod';
import {
  KIT_ARCHETYPES,
  ObjectKitSchema,
  type KitArchetype,
  type ObjectKit,
} from '@/lib/object-kit';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';

/**
 * Prompts and parsing for the Spark 3D « kit » of one object (PV-T9b). Spark only classifies and reads
 * colours; `kitToRecipe` builds the parts. The old free 12-part recipe took Spark more than 60 s on a
 * building (2026-11-01).
 */

export const SHAPE_SYSTEM_PROMPT = [
  'You describe ONE object seen on a photo crop so a SIMULATED rural microgrid editor can build a simple 3D model.',
  'Answer fast and short: do not plan 3D coordinates, the editor has the templates.',
  `archetype = the closest of: ${KIT_ARCHETYPES.join(', ')}.`,
  'proportions = real width, height, depth of the object, largest = 1 (guess the depth from what it is).',
  'colors: main = the biggest surface (walls, body, canopy), secondary = roof, stand, trunk or frame,',
  'accent = glass, windows, handle, lamp or wheels; each #rrggbb as seen.',
  'details (optional, small integers): windows on the front face, doors, wheels, legs, floors, chimney.',
  'Never give watts, kW or any energy value.',
].join(' ');

/**
 * User turn; the label is the detection name (from a model or typed by the operator), quoted.
 * `aspect` = width / height on the photo; `hint` = archetype the detection implies (Spark may change it).
 */
export function shapeQuestion(label: string, aspect?: number, hint?: KitArchetype): string {
  const name = label.slice(0, 40).replace(/"/g, "'");
  const seen =
    aspect && aspect > 0 && Number.isFinite(aspect)
      ? ` On the photo it is ${aspect.toFixed(2)} times as wide as it is high.`
      : '';
  const guess = hint ? ` It is probably a "${hint}".` : '';
  return `Describe the "${name}" in the clear rectangle in the middle of this crop.${seen}${guess}`;
}

const color = { type: 'string' };
const int = { type: 'integer' };

export const SHAPE_JSON_SCHEMA = {
  name: 'ObjectKit',
  schema: {
    type: 'object',
    properties: {
      archetype: { type: 'string', enum: [...KIT_ARCHETYPES] },
      proportions: {
        type: 'object',
        properties: { w: { type: 'number' }, h: { type: 'number' }, d: { type: 'number' } },
        required: ['w', 'h', 'd'],
      },
      colors: {
        type: 'object',
        properties: { main: color, secondary: color, accent: color },
        required: ['main', 'secondary', 'accent'],
      },
      details: {
        type: 'object',
        properties: {
          windows: int,
          doors: int,
          wheels: int,
          legs: int,
          floors: int,
          chimney: { type: 'boolean' },
        },
      },
    },
    required: ['archetype', 'proportions', 'colors'],
  },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const NEUTRAL = '#9aa3ad';
const HEX = /^#[0-9a-f]{6}$/i;

const ReplySchema = z.object({
  archetype: z.string(),
  proportions: z.object({ w: z.number(), h: z.number(), d: z.number() }),
  colors: z.record(z.string(), z.unknown()).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

const LIMITS = { windows: 8, doors: 3, wheels: 6, legs: 4, floors: 4 } as const;

/**
 * Spark reply → kit, or null when it is not JSON or misses the archetype / proportions.
 * Lenient: unknown archetype → `fallback`, proportions rescaled (largest = 1), bad colour → grey,
 * counts rounded and clamped, unknown details dropped.
 */
export function parseKit(content: string, fallback: KitArchetype = 'other'): ObjectKit | null {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return null;
  }
  const reply = ReplySchema.safeParse(json);
  if (!reply.success) return null;
  const { w, h, d } = reply.data.proportions;
  const max = Math.max(w, h, d);
  if (!(max > 0)) return null;
  const archetype = KIT_ARCHETYPES.find((a) => a === reply.data.archetype) ?? fallback;
  const pick = (k: string) => {
    const v = reply.data.colors?.[k];
    return typeof v === 'string' && HEX.test(v) ? v : NEUTRAL;
  };
  const details: NonNullable<ObjectKit['details']> = {};
  for (const [k, lim] of Object.entries(LIMITS) as Array<[keyof typeof LIMITS, number]>) {
    const v = reply.data.details?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) details[k] = clamp(Math.round(v), 0, lim);
  }
  if (reply.data.details?.chimney === true) details.chimney = true;
  const kit = ObjectKitSchema.safeParse({
    archetype,
    proportions: {
      w: clamp(w / max, 0.01, 1),
      h: clamp(h / max, 0.01, 1),
      d: clamp(d / max, 0.01, 1),
    },
    colors: { main: pick('main'), secondary: pick('secondary'), accent: pick('accent') },
    ...(Object.keys(details).length ? { details } : {}),
  });
  return kit.success ? kit.data : null;
}

const body = (color: string): RecipePart => ({
  shape: 'box',
  at: [0, 0, 0],
  size: [1, 1, 1],
  color,
  front: true,
});

/** Offline recipes (mock mode), so the demo always shows a shaped object. Unknown category → a plain box. */
const MOCK_RECIPES: Partial<Record<ApplianceCategory, ObjectRecipe>> = {
  fridge: {
    proportions: { w: 0.5, h: 1, d: 0.5 },
    parts: [
      body('#e6e9ec'),
      { shape: 'box', at: [0.38, 0.12, 0.51], size: [0.04, 0.35, 0.04], color: '#8a939c' },
      { shape: 'box', at: [0, 0.18, 0.5], size: [0.98, 0.01, 0.02], color: '#b9c0c7' },
    ],
  },
  tv: {
    proportions: { w: 1, h: 0.62, d: 0.12 },
    parts: [
      { ...body('#1d2329'), at: [0, 0.08, 0], size: [1, 0.84, 0.4] },
      { shape: 'box', at: [0, -0.46, 0], size: [0.3, 0.08, 1], color: '#2b3239' },
    ],
  },
  fan: {
    proportions: { w: 0.45, h: 1, d: 0.35 },
    parts: [
      { ...body('#d8dde2'), shape: 'cylinder', axis: 'z', at: [0, 0.28, 0], size: [1, 0.45, 0.3] },
      { shape: 'cylinder', at: [0, -0.15, 0], size: [0.08, 0.45, 0.1], color: '#a7afb7' },
      { shape: 'cylinder', at: [0, -0.47, 0], size: [0.7, 0.06, 0.9], color: '#a7afb7' },
    ],
  },
  lamp: {
    proportions: { w: 0.4, h: 1, d: 0.4 },
    parts: [
      { ...body('#f2d27a'), shape: 'cone', at: [0, 0.32, 0], size: [1, 0.35, 1] },
      { shape: 'cylinder', at: [0, -0.1, 0], size: [0.08, 0.6, 0.08], color: '#6f7780' },
      { shape: 'cylinder', at: [0, -0.46, 0], size: [0.6, 0.08, 0.6], color: '#6f7780' },
    ],
  },
};

const part = (
  shape: RecipePart['shape'],
  at: RecipePart['at'],
  size: RecipePart['size'],
  color: string,
  axis?: RecipePart['axis']
): RecipePart => ({ shape, at, size, color, ...(axis ? { axis } : {}) });

/** Offline recipes for scenery (no load), so houses, trees or cars also show in 3D. */
const MOCK_SCENERY: Partial<Record<SceneryType, ObjectRecipe>> = {
  building: {
    proportions: { w: 1, h: 0.75, d: 0.8 },
    parts: [
      { ...body('#c9b79c'), at: [0, -0.15, 0], size: [1, 0.7, 1] },
      part('box', [0, 0.32, 0], [1, 0.25, 1], '#8a5a44'),
      part('box', [-0.2, -0.3, 0.5], [0.16, 0.38, 0.02], '#5b3b2a'),
      part('box', [0.22, -0.12, 0.5], [0.18, 0.16, 0.02], '#9cc3d5'),
    ],
  },
  tree: {
    proportions: { w: 0.7, h: 1, d: 0.7 },
    parts: [
      { ...body('#4f8a4b'), shape: 'sphere', at: [0, 0.18, 0], size: [1, 0.64, 1] },
      part('cylinder', [0, -0.3, 0], [0.14, 0.4, 0.14], '#6b4a32'),
    ],
  },
  plant: {
    proportions: { w: 0.6, h: 1, d: 0.6 },
    parts: [
      { ...body('#5c9b55'), shape: 'sphere', at: [0, 0.15, 0], size: [1, 0.7, 1] },
      part('cylinder', [0, -0.35, 0], [0.6, 0.3, 0.6], '#a0603d'),
    ],
  },
  vehicle: {
    proportions: { w: 1, h: 0.45, d: 0.45 },
    parts: [
      { ...body('#3f6fa8'), at: [0, -0.05, 0], size: [1, 0.5, 1] },
      part('box', [-0.05, 0.32, 0], [0.55, 0.36, 0.9], '#2f5585'),
      part('cylinder', [-0.3, -0.38, 0], [0.18, 0.36, 1], '#222831', 'z'),
      part('cylinder', [0.3, -0.38, 0], [0.18, 0.36, 1], '#222831', 'z'),
    ],
  },
  person: {
    proportions: { w: 0.35, h: 1, d: 0.25 },
    parts: [
      { ...body('#4f6d8f'), shape: 'cylinder', at: [0, -0.12, 0], size: [0.8, 0.75, 0.8] },
      part('sphere', [0, 0.38, 0], [0.55, 0.22, 0.75], '#c99a73'),
    ],
  },
  animal: {
    proportions: { w: 1, h: 0.6, d: 0.4 },
    parts: [
      { ...body('#8b6b4a'), at: [0, 0.05, 0], size: [0.75, 0.45, 1] },
      part('box', [0.42, 0.28, 0], [0.22, 0.3, 0.6], '#7a5c3f'),
      part('cylinder', [-0.28, -0.32, 0], [0.1, 0.36, 0.2], '#6b4f36'),
      part('cylinder', [0.25, -0.32, 0], [0.1, 0.36, 0.2], '#6b4f36'),
    ],
  },
  water: {
    proportions: { w: 1, h: 0.08, d: 0.7 },
    parts: [{ ...body('#4c8fb8'), shape: 'cylinder' }],
  },
};

export function mockRecipe(category: ApplianceCategory, scenery?: SceneryType): ObjectRecipe {
  return (
    (scenery ? MOCK_SCENERY[scenery] : MOCK_RECIPES[category]) ?? {
      proportions: { w: 1, h: 1, d: 0.6 },
      parts: [body(NEUTRAL)],
    }
  );
}
