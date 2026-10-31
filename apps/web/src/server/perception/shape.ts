import type { ApplianceCategory } from '@mitsinjo/engine';
import { z } from 'zod';
import {
  MAX_RECIPE_PARTS,
  ObjectRecipeSchema,
  RECIPE_BOUND,
  RECIPE_SHAPES,
  type ObjectRecipe,
  type RecipePart,
} from '@/lib/object-shape';

/** Prompts and parsing for the Spark shape recipe of one object (PV-T9). */

export const SHAPE_SYSTEM_PROMPT = [
  'You turn ONE object seen on a photo crop into a simple 3D model for a SIMULATED rural microgrid editor.',
  `Build it from 1 to ${MAX_RECIPE_PARTS} primitive parts (box, cylinder, sphere, cone).`,
  'The object is centred at the origin: x right, y up, z toward the camera.',
  'proportions = the real width, height and depth of the object, largest = 1 (guess the depth from what the object is).',
  'For each part: at = its centre and size = its extent, both as fractions of the object width, height and depth',
  '(at between -0.5 and 0.5, size between 0.01 and 1); axis of a cylinder or cone (x, y or z, default y);',
  'color = the colour seen, #rrggbb. Put the main body first and mark it front = true: the photo goes on its front face.',
  'Add only the details that make the object recognisable (doors, handles, screen, legs, blades, stand).',
  'Never give watts, kW or any energy value.',
].join(' ');

/** User turn; the label is the detection name (from a model or typed by the operator), quoted. */
export function shapeQuestion(label: string): string {
  return `Build the 3D recipe of the "${label.slice(0, 40).replace(/"/g, "'")}" in the middle of this crop.`;
}

const vec3 = { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 };

export const SHAPE_JSON_SCHEMA = {
  name: 'ObjectRecipe',
  schema: {
    type: 'object',
    properties: {
      proportions: {
        type: 'object',
        properties: { w: { type: 'number' }, h: { type: 'number' }, d: { type: 'number' } },
        required: ['w', 'h', 'd'],
      },
      parts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            shape: { type: 'string', enum: [...RECIPE_SHAPES] },
            at: vec3,
            size: vec3,
            axis: { type: 'string', enum: ['x', 'y', 'z'] },
            color: { type: 'string' },
            front: { type: 'boolean' },
          },
          required: ['shape', 'at', 'size', 'color'],
        },
      },
    },
    required: ['proportions', 'parts'],
  },
};

const ReplySchema = z.object({
  proportions: z.object({ w: z.number(), h: z.number(), d: z.number() }),
  parts: z.array(z.unknown()),
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const NEUTRAL = '#9aa3ad';

/** One part as the model printed it → a valid part, or null (bad shape, missing vectors). */
function toPart(raw: unknown): RecipePart | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const nums = (v: unknown) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
      ? (v as [number, number, number])
      : null;
  const at = nums(p.at);
  const size = nums(p.size);
  const shape = RECIPE_SHAPES.find((s) => s === p.shape);
  if (!at || !size || !shape) return null;
  const color = typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : NEUTRAL;
  const axis = p.axis === 'x' || p.axis === 'y' || p.axis === 'z' ? p.axis : undefined;
  return {
    shape,
    at: at.map((c) => clamp(c, -RECIPE_BOUND, RECIPE_BOUND)) as RecipePart['at'],
    size: size.map((s) => clamp(s, 0.01, 1)) as RecipePart['size'],
    ...(axis ? { axis } : {}),
    color,
    ...(p.front === true ? { front: true } : {}),
  };
}

/**
 * Spark reply → recipe, or null when it is not JSON or has no usable part.
 * Lenient: proportions rescaled so the largest is 1, values clamped, bad parts dropped, bad colour → grey.
 * Whether the recipe *looks* right is `recipeIssue` (shared with the client).
 */
export function parseRecipe(content: string): ObjectRecipe | null {
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
  const parts = reply.data.parts.flatMap((raw) => toPart(raw) ?? []).slice(0, MAX_RECIPE_PARTS);
  const ok = ObjectRecipeSchema.safeParse({
    proportions: {
      w: clamp(w / max, 0.01, 1),
      h: clamp(h / max, 0.01, 1),
      d: clamp(d / max, 0.01, 1),
    },
    parts,
  });
  return ok.success ? ok.data : null;
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

export function mockRecipe(category: ApplianceCategory): ObjectRecipe {
  return MOCK_RECIPES[category] ?? { proportions: { w: 1, h: 1, d: 0.6 }, parts: [body(NEUTRAL)] };
}
