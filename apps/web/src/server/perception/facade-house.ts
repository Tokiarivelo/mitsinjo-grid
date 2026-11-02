import type { ObjectKit } from '@/lib/object-kit';
import { MAX_RECIPE_PARTS, type ObjectRecipe, type RecipePart } from '@/lib/object-shape';
import type { NormBox } from './schemas';
import { skylineFromRings } from './roofline';

/**
 * House rebuilt from its 2D elevations (user 2026-11-02): the validated front facade and, when
 * Muse Image drew it, the side elevation of the same house. Both are straight-on and unoccluded,
 * so SAM's boxes on them are measurements: walls, eave, roof shape, chimneys, windows, door, and
 * the depth from the side. The photo then only gives colours, materials and the yaw. Pure.
 */

type Ring = ReadonlyArray<readonly [number, number]>;

/** SAM answers on one elevation image (image fractions, x right, y down). */
export interface ElevationMasks {
  /** Image width / height in pixels. */
  aspect: number;
  house?: NormBox;
  roof?: { box: NormBox; rings?: ReadonlyArray<Ring> };
  wall?: NormBox;
  windows: ReadonlyArray<NormBox>;
  doors: ReadonlyArray<NormBox>;
  chimneys: ReadonlyArray<NormBox>;
  /** PG-T3, optional: stone base band, entry steps, glass panes (window / door grid). */
  plinths?: ReadonlyArray<NormBox>;
  steps?: ReadonlyArray<NormBox>;
  panes?: ReadonlyArray<NormBox>;
}

/** One elevation measured in its own pixel-aspect units (u = x · aspect, v = y). */
export interface Elevation {
  aspect: number;
  /** Roof edges (or walls when there is no roof), x image fractions. */
  left: number;
  right: number;
  wallLeft: number;
  wallRight: number;
  /** Roof top (ridge), eave and ground, y image fractions. */
  top: number;
  eave: number;
  bottom: number;
  /** Flat top of the roof as a share of its width (0 = pointed, 1 = flat); null = not measured. */
  ridge: number | null;
  windows: NormBox[];
  doors: NormBox[];
  chimneys: NormBox[];
  /** Base band at the foot of the walls (PG-T3), null when SAM sees none. */
  plinth: NormBox | null;
  /** Entry steps in front of a door (PG-T3). */
  steps: NormBox[];
  /** Glass panes inside the windows and doors (PG-T3): their grid gives the mullions. */
  panes: NormBox[];
  /** Roof outline on the drawing (SAM rings), for the elevation score (PG-T2). */
  roofRings?: Ring[];
}

/** A roof thinner than this share of the body height is a flat top (shop, block). */
export const MIN_ROOF_SHARE = 0.06;
/** Skyline columns within this share of the roof height from its top are on the ridge. */
const RIDGE_BAND = 0.08;
/** A ridge shorter than this share of the roof width is a peak (gable end, pyramid). */
export const PEAK_RIDGE = 0.15;
/** Walls narrower than this share of the body are a SAM miss (a pier, a door frame). */
const MIN_WALL_SHARE = 0.5;
/** Depth / wall width without a side view nor a Spark proportion. */
export const DEFAULT_DEPTH_RATIO = 0.6;
const DEPTH_RANGE = [0.2, 3] as const;
/** Decal thickness (windows, doors), share of the body height. */
const DECAL = 0.015;
/** Fixed door paint when no colour says otherwise: a door is wood or painted, never the roof. */
export const DOOR_COLOR = '#6b4a2f';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const right = (b: NormBox) => b.x + b.w;
const bottomOf = (b: NormBox) => b.y + b.h;

/**
 * Flat share of the roof top from its outline: skyline columns within `RIDGE_BAND` of the
 * highest roof point, chimney columns left out (they stand on the roof, they are not it).
 */
export function ridgeShare(
  rings: ReadonlyArray<Ring>,
  box: NormBox,
  chimneys: ReadonlyArray<NormBox> = []
): number | null {
  const sky = skylineFromRings(rings, box);
  const cols = sky.length;
  const tops: number[] = [];
  for (let c = 0; c < cols; c++) {
    const x = box.x + ((c + 0.5) / cols) * box.w;
    if (chimneys.some((ch) => x >= ch.x && x <= right(ch))) continue;
    if (Number.isFinite(sky[c]!)) tops.push(sky[c]!);
  }
  if (tops.length < cols / 3) return null;
  const min = Math.min(...tops);
  const flat = tops.filter((t) => t <= min + RIDGE_BAND).length;
  return clamp(flat / tops.length, 0, 1);
}

/**
 * One elevation from its SAM boxes, or null without a house, wall or roof to stand on. The
 * body spans roof + walls (chimneys excluded); the eave is the roof's lower edge.
 */
export function measureElevation(m: ElevationMasks): Elevation | null {
  const base = m.wall ?? m.house ?? m.roof?.box;
  if (!base || !(m.aspect > 0)) return null;
  const roof = m.roof?.box;
  const left = Math.min(
    ...[roof, m.wall, roof || m.wall ? undefined : m.house].flatMap((b) => (b ? [b.x] : []))
  );
  const rightX = Math.max(
    ...[roof, m.wall, roof || m.wall ? undefined : m.house].flatMap((b) => (b ? [right(b)] : []))
  );
  const bottom = Math.max(
    ...[m.house, m.wall, ...m.doors].flatMap((b) => (b ? [bottomOf(b)] : []))
  );
  // Roof top: the roof mask, else the house box below its chimneys.
  const chimneyFoot = m.chimneys.length ? Math.max(...m.chimneys.map(bottomOf)) : -1;
  const top = roof
    ? roof.y
    : m.house
      ? Math.max(m.house.y, Math.min(chimneyFoot, m.wall?.y ?? 1))
      : base.y;
  const bodyH = bottom - top;
  if (!(bodyH > 0) || !(rightX > left)) return null;
  let eave = roof ? bottomOf(roof) : (m.wall?.y ?? top);
  if (eave - top < MIN_ROOF_SHARE * bodyH) eave = top;
  eave = clamp(eave, top, bottom - 0.2 * bodyH);
  const wallOk = m.wall && m.wall.w >= MIN_WALL_SHARE * (rightX - left);
  const ridge =
    eave > top && m.roof?.rings?.length ? ridgeShare(m.roof.rings, m.roof.box, m.chimneys) : null;
  const inside = (b: NormBox) => b.x >= left - 0.02 && right(b) <= rightX + 0.02;
  return {
    aspect: m.aspect,
    left,
    right: rightX,
    wallLeft: wallOk ? m.wall!.x : left,
    wallRight: wallOk ? right(m.wall!) : rightX,
    top,
    eave,
    bottom,
    ridge,
    windows: m.windows.filter((b) => inside(b) && b.y >= eave - 0.02),
    doors: m.doors.filter((b) => inside(b) && b.y >= eave - 0.02),
    chimneys: m.chimneys.filter((b) => b.y < top + 0.5 * (eave - top) && inside(b)),
    plinth: plinthOf(m.plinths ?? [], left, rightX, bottom, bodyH),
    steps: (m.steps ?? []).filter((b) => inside(b) && Math.abs(bottomOf(b) - bottom) < 0.1 * bodyH),
    panes: (m.panes ?? []).filter((p) =>
      [...m.windows, ...m.doors].some(
        (o) =>
          p.x >= o.x - 0.01 &&
          right(p) <= right(o) + 0.01 &&
          p.y >= o.y - 0.01 &&
          bottomOf(p) <= bottomOf(o) + 0.01
      )
    ),
    ...(m.roof?.rings?.length ? { roofRings: m.roof.rings.map((r) => [...r]) } : {}),
  };
}

/** A plinth is a low band (≤ this share of the body height) across most of the walls, on the ground. */
const PLINTH_MAX_SHARE = 0.2;

/** The widest base band SAM found that sits on the ground and spans half the body, else null. */
function plinthOf(
  boxes: ReadonlyArray<NormBox>,
  left: number,
  rightX: number,
  bottom: number,
  bodyH: number
): NormBox | null {
  const ok = boxes.filter(
    (b) =>
      b.h <= PLINTH_MAX_SHARE * bodyH &&
      b.w >= 0.5 * (rightX - left) &&
      Math.abs(bottomOf(b) - bottom) < 0.05 * bodyH
  );
  return ok.length ? ok.reduce((a, b) => (b.w > a.w ? b : a)) : null;
}

/** Wall width over body height, in pixels. */
const wallRatio = (e: Elevation) => ((e.wallRight - e.wallLeft) * e.aspect) / (e.bottom - e.top);

/**
 * Depth / front wall width from the side elevation: both are scaled to the same body height
 * (walls + roof). Null without a side; clamped to a sane house.
 */
export function depthRatio(front: Elevation, side: Elevation | null): number | null {
  if (!side) return null;
  const r = wallRatio(side) / wallRatio(front);
  return Number.isFinite(r) ? clamp(r, ...DEPTH_RANGE) : null;
}

/** Side and Spark depths further apart than this factor: the side drawing's width is not trusted. */
export const DEPTH_AGREEMENT = 1.3;

/**
 * Depth / width, fused (live 2026-11-02: Muse Image draws a side sheet « fit to frame », once a
 * 4.6 m side as wide as the 7.8 m front). Spark reads the depth on the photo, where the side wall
 * is seen; the side drawing only refines it when both agree (geometric mean), else Spark wins.
 * Neither → `DEFAULT_DEPTH_RATIO`.
 */
export function fuseDepth(sideRatio: number | null, sparkRatio: number | undefined): number {
  const spark =
    sparkRatio && Number.isFinite(sparkRatio) && sparkRatio > 0
      ? clamp(sparkRatio, ...DEPTH_RANGE)
      : null;
  if (sideRatio === null) return spark ?? DEFAULT_DEPTH_RATIO;
  if (spark === null) return sideRatio;
  const factor = Math.max(sideRatio, spark) / Math.min(sideRatio, spark);
  return factor <= DEPTH_AGREEMENT ? Math.sqrt(sideRatio * spark) : spark;
}

/** Side and front body shapes closer than this (ratio) with both roofs peaked = a copied front. */
const COPY_RATIO = 0.15;
/** Eave share (roof height / body height) may differ this much between two views of one house. */
const EAVE_SHARE_TOLERANCE = 0.15;

const eaveShare = (e: Elevation) => (e.eave - e.top) / (e.bottom - e.top);
const peaked = (e: Elevation) => e.eave > e.top && e.ridge !== null && e.ridge < PEAK_RIDGE;

/**
 * What the side view must show of the roof, read on the front: a peaked front (gable on the
 * street) shows its long slope from the side, a long front ridge shows the roof's end.
 */
export function sideRoofHint(front: Elevation): 'slope' | 'end' | null {
  if (front.eave <= front.top || front.ridge === null) return null;
  return front.ridge < PEAK_RIDGE ? 'slope' : 'end';
}

/**
 * Whether a drawn side view can be trusted (user 2026-11-02, live: Muse Image once redrew the
 * front as the « side »). Rejected: storeys at another height (eave share apart), or a peaked
 * roof on both views with the same body shape — a copy, unless the plan is square.
 */
export function sideConsistent(front: Elevation, side: Elevation): boolean {
  if (Math.abs(eaveShare(front) - eaveShare(side)) > EAVE_SHARE_TOLERANCE) return false;
  if (peaked(front) && peaked(side)) {
    const r = wallRatio(side) / wallRatio(front);
    if (Math.abs(r - 1) < COPY_RATIO) return false;
  }
  return true;
}

export type RoofKind = 'flat' | 'gable' | 'hip';

/**
 * Roof form from the two flat shares. Front ridge long → hipped (or side gable when ≈ 1). Front
 * peaked → gable facing the street, unless the side is peaked too (pyramid = hip, ridge 0).
 */
export function roofKind(
  front: Elevation,
  side: Elevation | null
): { kind: RoofKind; ridge: number } {
  if (front.eave <= front.top) return { kind: 'flat', ridge: 0 };
  const f = front.ridge;
  if (f === null || f < PEAK_RIDGE) {
    if (side && side.ridge !== null && side.ridge < PEAK_RIDGE) return { kind: 'hip', ridge: 0 };
    return { kind: 'gable', ridge: 0 };
  }
  return { kind: 'hip', ridge: f > 1 - PEAK_RIDGE ? 1 : f };
}

export interface FacadeHouseInput {
  front: Elevation;
  side: Elevation | null;
  colors: ObjectKit['colors'];
  materials?: ObjectKit['materials'];
  /** Depth / width read by Spark on the photo (its kit proportions). */
  sparkDepth?: number;
}

/**
 * The house recipe: walls, the measured roof, chimneys, front door and windows from the front
 * elevation, side windows from the side one (right wall), ≤ 12 parts in that priority. Units:
 * front body height = 1; proportions carry the measured width / height / depth.
 */
export function facadeHouseRecipe({
  front,
  side,
  colors,
  materials,
  sparkDepth,
}: FacadeHouseInput): ObjectRecipe {
  const A = front.aspect;
  const H = front.bottom - front.top;
  const X = (x: number) => (x * A) / H;
  const Y = (y: number) => -(y - front.top) / H; // 0 at the ridge, −1 at the ground
  const cx = (X(front.wallLeft) + X(front.wallRight)) / 2;
  const wallW = X(front.wallRight) - X(front.wallLeft);
  const roofW = X(front.right) - X(front.left);
  const overhang = Math.max(0, (roofW - wallW) / 2);
  const depth = wallW * fuseDepth(depthRatio(front, side), sparkDepth);
  const yMid = -0.5; // body centre: half way from the ridge (0) to the ground (−1)
  const eaveY = Y(front.eave);
  const role = (r: keyof ObjectKit['colors']) => ({
    color: colors[r],
    ...(materials?.[r] ? { material: materials[r] } : {}),
  });
  const at = (x: number, y: number, z: number): RecipePart['at'] => [x, y - yMid, z];
  const box = (b: NormBox, z: number, thick: number): Pick<RecipePart, 'at' | 'size'> => ({
    at: at((X(b.x) + X(right(b))) / 2 - cx, (Y(b.y) + Y(bottomOf(b))) / 2, z),
    size: [X(right(b)) - X(b.x), Y(b.y) - Y(bottomOf(b)), thick],
  });
  const t = DECAL;
  const walls: RecipePart = {
    shape: 'box',
    at: at(0, (eaveY - 1) / 2, 0),
    size: [wallW, eaveY + 1, depth],
    front: true,
    ...role('main'),
  };
  const { kind, ridge } = roofKind(front, side);
  const roofH = -eaveY;
  const roof: RecipePart[] =
    kind === 'flat'
      ? []
      : [
          {
            shape: kind === 'hip' ? 'hip' : 'prism',
            at: at((X(front.left) + X(front.right)) / 2 - cx, eaveY / 2, 0),
            size: [roofW, roofH, depth + 2 * overhang],
            ...(kind === 'hip' ? { ridge } : { apex: 0.5 }),
            ...role('secondary'),
          },
        ];
  // Side image → house frame: x maps to depth z (image left = front, the right wall seen from
  // +x), y to the same body height. Null without a side view.
  const sideMap = side
    ? (() => {
        const sH = side.bottom - side.top;
        const mid = (side.wallLeft + side.wallRight) / 2;
        const zPerX = depth / Math.max(1e-6, side.wallRight - side.wallLeft);
        return {
          z: (x: number) => clamp(-(x - mid) * zPerX, -depth / 2, depth / 2),
          dz: (w: number) => w * zPerX,
          y: (v: number) => -(v - side.top) / sH,
        };
      })()
    : null;
  // Chimneys stand from the eave (hidden in the roof) to their measured top; their depth
  // position comes from the side view when it shows one.
  const sideChimney = side?.chimneys[0];
  const chimneyZ = sideChimney && sideMap ? sideMap.z(sideChimney.x + sideChimney.w / 2) : 0;
  const chimneys: RecipePart[] = front.chimneys.slice(0, 2).map((c) => {
    const w = X(right(c)) - X(c.x);
    const topY = Y(c.y);
    return {
      shape: 'box',
      at: at((X(c.x) + X(right(c))) / 2 - cx, (topY + eaveY) / 2, chimneyZ),
      size: [w, topY - eaveY, w],
      ...role('main'),
      material: 'brick',
    };
  });
  const zFront = depth / 2 + t / 2;
  const doors: RecipePart[] = front.doors.slice(0, 2).map((d) => ({
    shape: 'box',
    ...box(d, zFront, t),
    color: DOOR_COLOR,
    material: 'wood',
  }));
  const glass = { color: colors.accent, material: 'glass' as const };
  const byArea = (a: NormBox, b: NormBox) => b.w * b.h - a.w * a.h;
  const windows: RecipePart[] = [...front.windows]
    .sort(byArea)
    .map((w) => ({ shape: 'box', ...box(w, zFront, t), ...glass }));
  // Side windows on the right wall: side image x → depth z (image left = front).
  const sideWindows: RecipePart[] =
    side && sideMap
      ? [...side.windows].sort(byArea).map((w) => ({
          shape: 'box' as const,
          at: at(
            wallW / 2 + t / 2,
            (sideMap.y(w.y) + sideMap.y(bottomOf(w))) / 2,
            sideMap.z(w.x + w.w / 2)
          ),
          size: [t, sideMap.y(w.y) - sideMap.y(bottomOf(w)), sideMap.dz(w.w)] as RecipePart['size'],
          ...glass,
          // Seen on the imagined side elevation only.
          status: 'inferred' as const,
        }))
      : [];
  const measuredParts: RecipePart[] = [walls, ...roof, ...doors, ...chimneys, ...windows].map(
    (p) => ({
      ...p,
      status: 'measured' as const,
    })
  );
  const parts = [...measuredParts, ...sideWindows].slice(0, MAX_RECIPE_PARTS);
  // Bounds of every part → proportions (largest side 1); fitRecipe re-centres the parts.
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, p.at[i]! - p.size[i]! / 2);
      hi[i] = Math.max(hi[i]!, p.at[i]! + p.size[i]! / 2);
    }
  const span = lo.map((l, i) => hi[i]! - l);
  const max = Math.max(...span);
  return {
    proportions: { w: span[0]! / max, h: span[1]! / max, d: span[2]! / max },
    parts,
  };
}
