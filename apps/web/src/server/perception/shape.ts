import type { ApplianceCategory } from '@mitsinjo/engine';
import type { SceneryType } from '@/lib/vision';
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
  'Together the parts must fill the whole object from its lowest to its highest point and side to side.',
  'Thin objects stay thin: a lamp post is a tall thin cylinder (size about 0.1 wide, 1 high) plus its arm and lamp head at the top;',
  'a pole, antenna or mast the same. Never shrink the whole object to a small part in the middle.',
  'Buildings, trees, vehicles and other scenery follow the same rules. Never give watts, kW or any energy value.',
].join(' ');

/**
 * User turn; the label is the detection name (from a model or typed by the operator), quoted.
 * `aspect` = width / height of the object on the photo, so thin or wide objects keep their shape.
 */
export function shapeQuestion(label: string, aspect?: number): string {
  const name = label.slice(0, 40).replace(/"/g, "'");
  const seen =
    aspect && aspect > 0 && Number.isFinite(aspect)
      ? ` On the photo it is ${aspect.toFixed(2)} times as wide as it is high.`
      : '';
  return `Build the 3D recipe of the "${name}" in the clear rectangle in the middle of this crop.${seen}`;
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
