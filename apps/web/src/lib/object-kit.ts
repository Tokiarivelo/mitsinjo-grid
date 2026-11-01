import type { ApplianceCategory } from '@mitsinjo/engine';
import { z } from 'zod';
import type { ObjectRecipe, RecipePart } from './object-shape';
import type { SceneryType } from './vision';

/**
 * 3D « kit » of one object (PV-T9b): what Muse Spark returns instead of free 3D coordinates.
 * Spark only classifies (archetype), reads proportions, 3 colours and a few counts; `kitToRecipe`
 * builds the parts from fixed templates. Reason: a 12-part coordinate recipe made Spark think for
 * more than 60 s on a building (user report 2026-11-01); a kit is ~80 output tokens.
 */

export const KIT_ARCHETYPES = [
  'cabinet', // fridge, freezer, washing machine, cupboard, generic box appliance
  'screen', // TV, monitor, laptop, sign board
  'fan', // fan, round appliance on a stand
  'machine', // pump, mill, welder, generator: body + pipe / motor
  'lamp_post', // street lamp, light on a pole
  'pole', // utility pole, antenna, mast
  'tank', // water tank, barrel, round container
  'panel', // solar panel, board on legs
  'house', // house, cottage, hut (pitched roof)
  'building', // flat-roof building, shop, school, block
  'tree',
  'bush', // bush, plant, hedge, flower bed
  'vehicle', // car, truck, motorbike, cart
  'person',
  'animal',
  'water', // river, pond, pool (flat)
  'other', // plain box
] as const;
export type KitArchetype = (typeof KIT_ARCHETYPES)[number];

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const count = (max: number) => z.number().int().min(0).max(max);

export const ObjectKitSchema = z.object({
  archetype: z.enum(KIT_ARCHETYPES),
  /** Real proportions, largest side = 1. */
  proportions: z.object({
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
    d: z.number().min(0.01).max(1),
  }),
  /** main = biggest surface (walls, body), secondary = roof / stand / trunk, accent = glass, handle, lamp. */
  colors: z.object({ main: hex, secondary: hex, accent: hex }),
  /** Front windows (houses: per floor), doors, wheels, legs, floors. Absent = template default. */
  details: z
    .object({
      windows: count(8).optional(),
      doors: count(3).optional(),
      wheels: count(6).optional(),
      legs: count(4).optional(),
      floors: count(4).optional(),
      chimney: z.boolean().optional(),
    })
    .optional(),
});
export type ObjectKit = z.infer<typeof ObjectKitSchema>;

/** Archetype the detection already implies (mock mode, and the hint sent to Spark). */
export function defaultArchetype(category: ApplianceCategory, scenery?: SceneryType): KitArchetype {
  if (scenery) {
    const byScenery: Record<SceneryType, KitArchetype> = {
      building: 'house',
      vehicle: 'vehicle',
      tree: 'tree',
      plant: 'bush',
      person: 'person',
      animal: 'animal',
      water: 'water',
      other: 'other',
    };
    return byScenery[scenery];
  }
  const byCategory: Record<ApplianceCategory, KitArchetype> = {
    fridge: 'cabinet',
    freezer: 'cabinet',
    fridge_vaccine: 'cabinet',
    tv: 'screen',
    computer: 'screen',
    laptop: 'screen',
    lamp: 'lamp_post',
    fan: 'fan',
    radio: 'cabinet',
    phone_charger: 'cabinet',
    water_pump: 'machine',
    rice_mill: 'machine',
    sewing_machine: 'machine',
    welder: 'machine',
    other: 'other',
  };
  return byCategory[category];
}

type Vec = [number, number, number];
const part = (
  shape: RecipePart['shape'],
  at: Vec,
  size: Vec,
  color: string,
  extra: Partial<Pick<RecipePart, 'axis' | 'front'>> = {}
): RecipePart => ({ shape, at, size, color, ...extra });

/** `n` centres spread evenly over [-span/2, span/2]. */
const spread = (n: number, span: number) =>
  Array.from({ length: n }, (_, i) => (n === 1 ? 0 : -span / 2 + (span * i) / (n - 1)));

/** Width of `n` decals over `span`: at most `max`, and ≤ 70 % of their pitch so they never overlap. */
export const decalWidth = (n: number, span: number, max: number) =>
  n <= 1 ? max : Math.min(max, (0.7 * span) / (n - 1));

type Template = (k: ObjectKit) => RecipePart[];

const TEMPLATES: Record<KitArchetype, Template> = {
  cabinet: ({ colors: c, details: d }) => [
    part('box', [0, 0, 0], [1, 1, 1], c.main, { front: true }),
    part('box', [0.38, 0.1, 0.51], [0.05, 0.3, 0.04], c.accent),
    ...((d?.doors ?? 2) >= 2
      ? [part('box', [0, 0.18, 0.5], [0.98, 0.015, 0.02], c.secondary)]
      : []),
  ],
  screen: ({ colors: c }) => [
    part('box', [0, 0.08, 0], [1, 0.84, 0.35], c.main, { front: true }),
    part('box', [0, -0.37, 0], [0.12, 0.08, 0.3], c.secondary),
    part('box', [0, -0.45, 0], [0.4, 0.06, 1], c.secondary),
  ],
  fan: ({ colors: c }) => [
    part('cylinder', [0, 0.28, 0], [1, 0.45, 0.3], c.main, { axis: 'z', front: true }),
    part('cylinder', [0, -0.15, 0], [0.08, 0.45, 0.1], c.secondary),
    part('cylinder', [0, -0.47, 0], [0.7, 0.06, 0.9], c.secondary),
  ],
  machine: ({ colors: c }) => [
    part('box', [0, -0.12, 0], [1, 0.76, 1], c.main, { front: true }),
    part('cylinder', [0.25, 0.38, 0], [0.35, 0.24, 0.5], c.secondary, { axis: 'x' }),
    part('cylinder', [-0.3, 0.33, 0], [0.12, 0.3, 0.2], c.accent),
  ],
  lamp_post: ({ colors: c }) => [
    part('cylinder', [0, -0.06, 0], [0.16, 0.86, 0.16], c.main),
    part('box', [0, 0.4, 0], [0.9, 0.18, 0.9], c.accent, { front: true }),
    part('cone', [0, 0.47, 0], [1, 0.06, 1], c.secondary),
    part('cylinder', [0, -0.47, 0], [0.4, 0.06, 0.4], c.secondary),
  ],
  pole: ({ colors: c }) => [
    part('cylinder', [0, 0, 0], [0.22, 1, 0.22], c.main, { front: true }),
    part('box', [0, 0.4, 0], [1, 0.05, 0.15], c.secondary),
  ],
  tank: ({ colors: c }) => [
    part('cylinder', [0, -0.03, 0], [1, 0.94, 1], c.main, { front: true }),
    part('cylinder', [0, 0.47, 0], [0.96, 0.06, 0.96], c.secondary),
  ],
  panel: ({ colors: c, details: d }) => [
    part('box', [0, 0.15, 0], [1, 0.7, 0.12], c.main, { front: true }),
    ...spread(Math.max(1, Math.min(4, d?.legs ?? 2)), 0.8).map((x) =>
      part('box', [x, -0.35, 0], [0.06, 0.3, 0.12], c.secondary)
    ),
  ],
  house: ({ colors: c, details: d }) => {
    const windows = Math.min(8, d?.windows ?? 3);
    const doors = Math.min(3, d?.doors ?? 1);
    return [
      part('box', [0, -0.2, 0], [1, 0.6, 1], c.main, { front: true }),
      // Stepped roof: three slabs read as a pitched roof with box primitives only.
      part('box', [0, 0.16, 0], [1, 0.12, 1], c.secondary),
      part('box', [0, 0.28, 0], [0.72, 0.12, 0.74], c.secondary),
      part('box', [0, 0.4, 0], [0.42, 0.12, 0.48], c.secondary),
      ...(d?.chimney ? [part('box', [0.3, 0.38, 0], [0.08, 0.24, 0.1], c.main)] : []),
      ...spread(windows, 0.76).map((x) =>
        part('box', [x, -0.06, 0.505], [decalWidth(windows, 0.76, 0.11), 0.14, 0.02], c.accent)
      ),
      ...spread(doors, 0.5).map((x) =>
        part('box', [x, -0.36, 0.505], [decalWidth(doors, 0.5, 0.1), 0.28, 0.02], c.secondary)
      ),
    ];
  },
  building: ({ colors: c, details: d }) => {
    const floors = Math.max(1, Math.min(4, d?.floors ?? 2));
    const windows = Math.max(1, Math.min(8, d?.windows ?? 4));
    const bodyH = 0.92;
    return [
      part('box', [0, -0.04, 0], [1, bodyH, 1], c.main, { front: true }),
      part('box', [0, 0.46, 0], [1.0, 0.08, 1.0], c.secondary),
      ...Array.from({ length: floors }, (_, f) => {
        const y = -0.5 + ((f + 0.6) * bodyH) / floors;
        return spread(windows, 0.8).map((x) =>
          part('box', [x, y, 0.505], [decalWidth(windows, 0.8, 0.08), 0.1, 0.02], c.accent)
        );
      }).flat(),
    ].slice(0, 12);
  },
  tree: ({ colors: c }) => [
    part('sphere', [0, 0.18, 0], [1, 0.64, 1], c.main, { front: true }),
    part('cylinder', [0, -0.3, 0], [0.14, 0.4, 0.14], c.secondary),
  ],
  bush: ({ colors: c }) => [
    part('sphere', [0, 0.05, 0], [1, 0.9, 1], c.main, { front: true }),
    part('sphere', [0.25, 0.25, 0.1], [0.4, 0.4, 0.4], c.accent),
  ],
  vehicle: ({ colors: c, details: d }) => {
    const wheels = Math.max(2, Math.min(6, d?.wheels ?? 4));
    const perSide = Math.ceil(wheels / 2);
    return [
      part('box', [0, -0.05, 0], [1, 0.5, 1], c.main, { front: true }),
      part('box', [-0.05, 0.32, 0], [0.55, 0.36, 0.9], c.secondary),
      ...spread(perSide, 0.6).map((x) =>
        part('cylinder', [x, -0.38, 0], [0.18, 0.36, 1], c.accent, { axis: 'z' })
      ),
    ];
  },
  person: ({ colors: c }) => [
    part('cylinder', [0, -0.12, 0], [0.8, 0.75, 0.8], c.main, { front: true }),
    part('sphere', [0, 0.38, 0], [0.55, 0.22, 0.75], c.secondary),
  ],
  animal: ({ colors: c, details: d }) => [
    part('box', [0, 0.05, 0], [0.75, 0.45, 1], c.main, { front: true }),
    part('box', [0.42, 0.28, 0], [0.22, 0.3, 0.6], c.secondary),
    ...spread(Math.max(2, Math.min(4, d?.legs ?? 4)) === 2 ? 1 : 2, 0.55).map((x) =>
      part('cylinder', [x, -0.32, 0], [0.1, 0.36, 0.2], c.secondary)
    ),
  ],
  water: ({ colors: c }) => [part('cylinder', [0, 0, 0], [1, 1, 1], c.main, { front: true })],
  other: ({ colors: c }) => [part('box', [0, 0, 0], [1, 1, 1], c.main, { front: true })],
};

/** Kit → parts recipe (≤ 12 parts, inside the object box). Pure: same kit → same recipe. */
export function kitToRecipe(kit: ObjectKit): ObjectRecipe {
  return {
    proportions: kit.proportions,
    parts: TEMPLATES[kit.archetype](kit).slice(0, 12),
  };
}
