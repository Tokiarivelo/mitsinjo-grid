/**
 * Where each inserted appliance is drawn on the 2D diagrams: a small named card ("pill") in free
 * space, wired to its sector feeder (branch mode) or to the EMS controller (ems mode).
 * Pure and deterministic: same appliances → same boxes. Pills never overlap a card, a kW tag, the
 * bus label, another pill or any wire; their routes never pass under a box.
 */
import type { SectorId } from '@mitsinjo/engine';
import {
  DIAGRAM_H,
  DIAGRAM_SECTORS,
  DIAGRAM_W,
  boxesOverlap,
  segmentCrossesBox,
  type Box,
  type DiagramLayout,
  type DiagramVariant,
  type Pt,
} from './diagram-layout';

export interface AppliancePillInput {
  id: string;
  sector: SectorId;
  connectionMode?: 'branch' | 'ems';
}

export interface AppliancePill {
  /** Card box (SVG user units). */
  box: Box;
  /** Wire from the tap (feeder or controller) to the card edge. */
  route: Pt[];
}

export const PILL_W = { topology: 36, circuit: 38 } as const;
/** Two lines: name, then the engine kW. */
export const PILL_H = 13;
/** One line (name only): circuit EMS strip above the first feeder row. */
export const PILL_H_COMPACT = 9;
/** Free space kept around a pill (wires and boxes). */
const CLEAR = 1.5;
/** Taps stay this far from the ends of a feeder (bus junction, card edge). */
const TAP_END_GAP = 4;
const TAP_STEP = 2;
/** Longest wire to a card (keeps it next to its sector and bounds the search). */
const MAX_REACH = 70;
/** The village plan holds about this many cards; later lines keep the short branch stub. */
export const MAX_TOPOLOGY_PILLS = 12;

const inflate = (b: Box, d: number): Box => ({
  x: b.x - d,
  y: b.y - d,
  w: b.w + 2 * d,
  h: b.h + 2 * d,
});

/** Every fixed label box of a layout (cards, tags, bus label). */
export function layoutBoxes(l: DiagramLayout): Box[] {
  return [
    l.boxes.solar,
    l.boxes.hub,
    l.boxes.controller,
    l.busLabel,
    ...DIAGRAM_SECTORS.map((id) => l.boxes.sectors[id]),
    ...DIAGRAM_SECTORS.map((id) => l.feederTags[id]),
  ];
}

type Seg = [Pt, Pt];

function polylineSegs(points: readonly Pt[]): Seg[] {
  const out: Seg[] = [];
  for (let k = 1; k < points.length; k++) out.push([points[k - 1]!, points[k]!]);
  return out;
}

function layoutWires(l: DiagramLayout): Seg[] {
  return [
    ...polylineSegs(l.wires.solarToHub),
    ...polylineSegs(l.wires.hubToBus),
    ...(l.wires.controllerToBus ? polylineSegs(l.wires.controllerToBus) : []),
    [l.busBar[0], l.busBar[1]],
    ...DIAGRAM_SECTORS.flatMap((id) => polylineSegs(l.wires.busToSector[id])),
  ];
}

/** Axis-aligned segments share a point (touching counts). */
function segsTouch([a, b]: Seg, [c, d]: Seg): boolean {
  const ax = Math.min(a[0], b[0]);
  const bx = Math.max(a[0], b[0]);
  const ay = Math.min(a[1], b[1]);
  const by = Math.max(a[1], b[1]);
  const cx = Math.min(c[0], d[0]);
  const dx = Math.max(c[0], d[0]);
  const cy = Math.min(c[1], d[1]);
  const dy = Math.max(c[1], d[1]);
  return ax <= dx && cx <= bx && ay <= dy && cy <= by;
}

interface Tap {
  at: Pt;
  /** Orientation of the first leg (perpendicular to what it leaves). */
  firstLeg: 'h' | 'v';
}

/** Tap points along a feeder, leaving it at a right angle. */
function feederTaps(points: readonly Pt[]): Tap[] {
  const taps: Tap[] = [];
  for (const [a, b] of polylineSegs(points)) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 2 * TAP_END_GAP) continue;
    const firstLeg = a[0] === b[0] ? 'h' : 'v';
    for (let t = TAP_END_GAP; t <= len - TAP_END_GAP; t += TAP_STEP) {
      const k = t / len;
      taps.push({ at: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], firstLeg });
    }
  }
  return taps;
}

/** Taps on the left and right sides of the EMS controller card. */
function controllerTaps(c: Box): Tap[] {
  const taps: Tap[] = [];
  for (let y = c.y + 4; y <= c.y + c.h - 4; y += TAP_STEP) {
    taps.push({ at: [c.x, y], firstLeg: 'h' }, { at: [c.x + c.w, y], firstLeg: 'h' });
  }
  return taps;
}

/** L-shaped route from a tap to the nearest side of a pill. */
function routeTo(tap: Tap, p: Box): Pt[] {
  const [tx, ty] = tap.at;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  if (tap.firstLeg === 'h') {
    if (ty > p.y && ty < p.y + p.h) return [tap.at, [tx < p.x ? p.x : p.x + p.w, ty]];
    return [tap.at, [cx, ty], [cx, ty < p.y ? p.y : p.y + p.h]];
  }
  if (tx > p.x && tx < p.x + p.w) return [tap.at, [tx, ty < p.y ? p.y : p.y + p.h]];
  return [tap.at, [tx, cy], [tx < p.x ? p.x : p.x + p.w, cy]];
}

const routeLength = (r: Pt[]): number =>
  polylineSegs(r).reduce((s, [a, b]) => s + Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]), 0);

/** Route clear of every box and wire (it may only touch what it leaves at the tap). */
function routeClear(route: Pt[], boxes: readonly Box[], wires: readonly Seg[], own: Box): boolean {
  const segs = polylineSegs(route);
  for (let i = 0; i < segs.length; i++) {
    const b = segs[i]![1];
    let a = segs[i]![0];
    if (i === 0) {
      // Leave the tap: ignore the half-unit that sits on the feeder / controller edge.
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len <= 0.5) continue;
      const k = 0.5 / len;
      a = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    for (const box of boxes) {
      if (box !== own && segmentCrossesBox(a, b, box)) return false;
    }
    for (const w of wires) if (segsTouch([a, b], w)) return false;
  }
  return true;
}

/** Topology: nearest free spot (shortest wire) found on a grid. */
function searchPill(tapsOf: Tap[], w: number, boxes: Box[], wires: Seg[]): AppliancePill | null {
  let best: AppliancePill | null = null;
  let bestLen = Infinity;
  const blocked = boxes.map((b) => inflate(b, CLEAR));
  // Bounding box of the taps: a card farther than MAX_REACH from it is never chosen.
  const tx0 = Math.min(...tapsOf.map((t) => t.at[0]));
  const tx1 = Math.max(...tapsOf.map((t) => t.at[0]));
  const ty0 = Math.min(...tapsOf.map((t) => t.at[1]));
  const ty1 = Math.max(...tapsOf.map((t) => t.at[1]));
  // Nearest spots first: a wire is never shorter than its card's distance to the taps, so the
  // search stops as soon as the next spot is farther than the best wire found.
  const spots: { x: number; y: number; reach: number }[] = [];
  for (let y = 1; y + PILL_H <= DIAGRAM_H - 1; y += 1.5) {
    for (let x = 1; x + w <= DIAGRAM_W - 1; x += 2) {
      const reach = Math.max(tx0 - (x + w), 0, x - tx1) + Math.max(ty0 - (y + PILL_H), 0, y - ty1);
      if (reach <= MAX_REACH) spots.push({ x, y, reach });
    }
  }
  spots.sort((a, b) => a.reach - b.reach || a.y - b.y || a.x - b.x);
  for (const { x, y, reach } of spots) {
    if (reach >= bestLen) break;
    {
      const pill: Box = { x, y, w, h: PILL_H };
      const halo = inflate(pill, CLEAR);
      if (blocked.some((b) => boxesOverlap(halo, b))) continue;
      if (wires.some(([a, b]) => segmentCrossesBox(a, b, halo))) continue;
      for (const tap of tapsOf) {
        // Lower bound before building the route.
        const dx = Math.max(pill.x - tap.at[0], 0, tap.at[0] - (pill.x + w));
        const dy = Math.max(pill.y - tap.at[1], 0, tap.at[1] - (pill.y + PILL_H));
        if (dx + dy >= bestLen) continue;
        const route = routeTo(tap, pill);
        const len = routeLength(route);
        if (len >= bestLen || len < 3) continue;
        if (!routeClear(route, boxes, wires, pill)) continue;
        best = { box: pill, route };
        bestLen = len;
      }
    }
  }
  return best;
}

/** Circuit: cards leave a column on the right; each row stacks up to 2 pills beside its card. */
function circuitPill(a: AppliancePillInput, slot: number, l: DiagramLayout): AppliancePill | null {
  const w = PILL_W.circuit;
  if (a.connectionMode === 'ems') {
    const c = l.boxes.controller;
    const x = c.x + c.w + 4 + slot * (w + 4);
    if (x + w > DIAGRAM_W - 1) return null;
    const box: Box = { x, y: 1.5, w, h: PILL_H_COMPACT };
    const busY = box.y + PILL_H_COMPACT + 1.5;
    return {
      box,
      route: [
        [c.x + c.w, busY],
        [x + w / 2, busY],
        [x + w / 2, box.y + PILL_H_COMPACT],
      ],
    };
  }
  if (slot > 1) return null;
  const card = l.boxes.sectors[a.sector];
  const x = card.x + card.w + 3;
  const y = card.y + slot * (card.h - PILL_H);
  const box: Box = { x, y, w, h: PILL_H };
  const midY = card.y + card.h / 2;
  const cy = y + PILL_H / 2;
  return {
    box,
    route: [
      [card.x + card.w, midY],
      [x - 2, midY],
      [x - 2, cy],
      [x, cy],
    ],
  };
}

/**
 * Pill box + route for every appliance, in input order. Missing ids found no free spot: the
 * diagram falls back to the short branch stub (`applianceBranchRoute`).
 */
export function appliancePills(
  appliances: readonly AppliancePillInput[],
  variant: DiagramVariant,
  layout: DiagramLayout
): Record<string, AppliancePill> {
  const out: Record<string, AppliancePill> = {};
  if (variant === 'circuit') {
    const seen = new Map<string, number>();
    for (const a of appliances) {
      const group = a.connectionMode === 'ems' ? 'ems' : a.sector;
      const n = seen.get(group) ?? 0;
      seen.set(group, n + 1);
      const pill = circuitPill(a, n, layout);
      if (pill) out[a.id] = pill;
    }
    return out;
  }
  const boxes = layoutBoxes(layout);
  const wires = layoutWires(layout);
  const w = PILL_W.topology;
  for (const a of appliances.slice(0, MAX_TOPOLOGY_PILLS)) {
    const taps =
      a.connectionMode === 'ems'
        ? controllerTaps(layout.boxes.controller)
        : feederTaps(layout.wires.busToSector[a.sector]);
    const pill = searchPill(taps, w, boxes, wires);
    if (!pill) continue;
    out[a.id] = pill;
    boxes.push(pill.box);
    wires.push(...polylineSegs(pill.route));
  }
  return out;
}
