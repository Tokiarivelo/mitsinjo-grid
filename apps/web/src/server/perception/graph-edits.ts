import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { deltaE2000, hexToLab } from './color-measure';
import { applyConstraints, buildGraph, type GraphEvidence, type ObjectGraph } from './object-graph';
import { segmentWall, type FaceRect } from './wall-openings';

/**
 * Parametric edits (PR-2.18, archi rule 3): resize or move an opening, chimney or part, and the
 * recipe is rebuilt deterministically — constraints re-solve, never an arbitrary rebuild.
 * Openings re-tile their wall (the glass, the hole and the shared strips move as one); walls
 * with openings are edited through their openings only (a lone strip move would tear the
 * tiling). Values are unit-box fractions, or meters through the estimated scale; edited
 * geometry reads `estimated` (asserted, no longer photo-measured). UI/copilot wiring is out.
 * Pure: same inputs → same recipe. Throws on programmer errors (bad node, inapplicable param).
 */

export interface EditValue {
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  h?: number;
  d?: number;
}

export interface GraphEdit {
  /** Part index in the recipe (= node index in the graph). */
  node: number;
  param: 'size' | 'position';
  value: EditValue;
  /** Meters per unit-box-1 when `unit` is meters (the estimated scale). */
  unit?: 'units' | 'meters';
  scale?: number;
}

export interface EditResult {
  recipe: ObjectRecipe;
  graph: ObjectGraph;
}

/** Schema bounds: at −0.6…0.6, size 0.01…1. */
const clampAt = (v: number) => Math.min(0.6, Math.max(-0.6, v));
const clampSize = (v: number) => Math.min(1, Math.max(0.01, v));

/** Inset opening leaf: thin-z box strictly inside its parent's depth. */
function isInsetLeaf(p: RecipePart, parent: RecipePart): boolean {
  if (p === parent || p.shape !== 'box' || p.size[2] > 0.05) return false;
  if (p.size[2] > Math.min(p.size[0], p.size[1])) return false;
  const inset = parent.size[2] / 2 - (Math.abs(p.at[2] - parent.at[2]) + p.size[2] / 2);
  return inset > 0.02;
}

/**
 * Wall tiling strip: the wall node's depth footprint in the wall paint (ΔE: a later pass may
 * re-tint a strip a digit). Roof slabs share the parent but not the footprint + paint.
 */
function isWallStrip(p: RecipePart, parent: RecipePart): boolean {
  if (p === parent || p.shape !== 'box') return false;
  if (Math.abs(p.at[2] - parent.at[2]) > 1e-9 || Math.abs(p.size[2] - parent.size[2]) > 1e-9) {
    return false;
  }
  return deltaE2000(hexToLab(p.color), hexToLab(parent.color)) < 3;
}

function rectOf(p: RecipePart): FaceRect {
  return { x: p.at[0], y: p.at[1], w: p.size[0], h: p.size[1] };
}

/**
 * Resize or move one node. Openings re-tile their wall; anything else transforms in place and
 * the constraints re-solve (panels clamp, stacks seat). Returns the rebuilt recipe + graph.
 */
export function applyEdit(
  archetype: KitArchetype,
  recipe: ObjectRecipe,
  edit: GraphEdit,
  evidence?: GraphEvidence
): EditResult {
  const part = recipe.parts[edit.node];
  if (!part) throw new Error(`applyEdit: node ${edit.node} out of range`);
  let { x, y, z, w, h, d } = edit.value;
  if (edit.unit === 'meters') {
    if (!edit.scale || edit.scale <= 0) {
      throw new Error('applyEdit: metric values need a positive scale (meters per unit)');
    }
    x = x === undefined ? x : x / edit.scale;
    y = y === undefined ? y : y / edit.scale;
    z = z === undefined ? z : z / edit.scale;
    w = w === undefined ? w : w / edit.scale;
    h = h === undefined ? h : h / edit.scale;
    d = d === undefined ? d : d / edit.scale;
  }
  if (edit.param === 'size' && (x !== undefined || y !== undefined || z !== undefined)) {
    throw new Error('applyEdit: a size edit takes w/h/d, not x/y/z');
  }
  if (edit.param === 'position' && (w !== undefined || h !== undefined || d !== undefined)) {
    throw new Error('applyEdit: a position edit takes x/y/z, not w/h/d');
  }
  const graph = buildGraph(archetype, recipe, evidence);
  const parentIdx = graph.nodes[edit.node]!.parent;
  const parent = parentIdx === null ? null : recipe.parts[parentIdx]!;
  const wallHasLeaves = (idx: number) =>
    graph.nodes.some(
      (n) => n.parent === idx && isInsetLeaf(recipe.parts[n.index]!, recipe.parts[idx]!)
    );
  // A wall with openings is edited through its openings: lone strip moves would tear the
  // tiling, so strips (and the wall node itself) are rejected with a pointer.
  if (parent && isInsetLeaf(part, parent)) {
    if (z !== undefined || d !== undefined) {
      throw new Error('applyEdit: opening edits use the face plane (x/y/w/h), not z/d');
    }
    return editOpening(
      archetype,
      recipe,
      edit.node,
      parentIdx!,
      edit.param,
      { x, y, w, h },
      evidence
    );
  }
  if (
    wallHasLeaves(edit.node) ||
    (parent && parentIdx !== null && wallHasLeaves(parentIdx) && isWallStrip(part, parent))
  ) {
    throw new Error(
      `applyEdit: node ${edit.node} belongs to a wall with openings — edit the opening, not the strip`
    );
  }
  const at: [number, number, number] = [...part.at] as [number, number, number];
  const size: [number, number, number] = [...part.size] as [number, number, number];
  if (edit.param === 'position') {
    if (x !== undefined) at[0] = clampAt(x);
    if (y !== undefined) at[1] = clampAt(y);
    if (z !== undefined) at[2] = clampAt(z);
  } else {
    if (w !== undefined) size[0] = clampSize(w);
    if (h !== undefined) size[1] = clampSize(h);
    if (d !== undefined) size[2] = clampSize(d);
  }
  const parts = recipe.parts.slice();
  parts[edit.node] = { ...part, at, size };
  return finish(archetype, recipe, parts, new Set([edit.node]), evidence);
}

/** Re-tile the wall around the edited hole; a hole edited to nothing heals the wall. */
function editOpening(
  archetype: KitArchetype,
  recipe: ObjectRecipe,
  node: number,
  parentIdx: number,
  param: 'size' | 'position',
  value: { x?: number; y?: number; w?: number; h?: number },
  evidence?: GraphEvidence
): EditResult {
  const graph = buildGraph(archetype, recipe, evidence);
  const parent = recipe.parts[parentIdx]!;
  const wallParts = graph.nodes
    .filter((n) => n.parent === parentIdx || n.index === parentIdx)
    .map((n) => recipe.parts[n.index]!)
    .filter((p) => p === parent || isWallStrip(p, parent) || isInsetLeaf(p, parent));
  const leaves = wallParts.filter((p) => p !== parent && isInsetLeaf(p, parent));
  // Wall bounds from the tiling itself (the wall box is gone): bbox of strips + leaves.
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of wallParts) {
    x0 = Math.min(x0, p.at[0] - p.size[0] / 2);
    x1 = Math.max(x1, p.at[0] + p.size[0] / 2);
    y0 = Math.min(y0, p.at[1] - p.size[1] / 2);
    y1 = Math.max(y1, p.at[1] + p.size[1] / 2);
  }
  const wall: FaceRect = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  const edited = recipe.parts[node]!;
  const holes = leaves.map((l) => {
    const r = rectOf(l);
    if (l !== edited) return { hole: r, paint: { color: l.color, material: l.material } };
    return {
      hole: {
        x: param === 'position' && value.x !== undefined ? value.x : r.x,
        y: param === 'position' && value.y !== undefined ? value.y : r.y,
        w: param === 'size' && value.w !== undefined ? value.w : r.w,
        h: param === 'size' && value.h !== undefined ? value.h : r.h,
      },
      paint: { color: l.color, material: l.material },
    };
  });
  const seg = segmentWall(
    wall,
    holes.map((o) => o.hole)
  );
  const rest = recipe.parts.filter((p) => !wallParts.includes(p));
  // A merged hole keeps the paint of its first source (deterministic: input order).
  const paintOf = (h: FaceRect) =>
    holes.find(
      (o) =>
        Math.abs(o.hole.x - h.x) * 2 < o.hole.w + h.w &&
        Math.abs(o.hole.y - h.y) * 2 < o.hole.h + h.h
    )?.paint ?? holes[0]!.paint;
  // Healed wall (no hole survives): one strip, the wall node again.
  const strips: RecipePart[] = (
    seg?.strips ?? [{ x: wall.x, y: wall.y, w: wall.w, h: wall.h }]
  ).map((s) => ({
    shape: 'box',
    at: [s.x, s.y, parent.at[2]],
    size: [s.w, s.h, parent.size[2]],
    color: parent.color,
    ...(parent.material ? { material: parent.material } : {}),
  }));
  let wallNode = strips[0]!;
  for (const s of strips) {
    if (s.size[0] * s.size[1] > wallNode.size[0] * wallNode.size[1]) wallNode = s;
  }
  wallNode.front = true;
  const outLeaves: RecipePart[] = (seg?.holes ?? []).map((h) => {
    const pc = paintOf(h);
    return {
      shape: 'box',
      at: [h.x, h.y, parent.at[2]],
      size: [h.w, h.h, edited.size[2]],
      color: pc.color,
      ...(pc.material ? { material: pc.material } : {}),
    };
  });
  const parts = [...rest, ...strips, ...outLeaves];
  const touched = new Set(parts.map((_, i) => i).filter((i) => i >= rest.length));
  return finish(archetype, recipe, parts, touched, evidence);
}

/** Constraints re-solve, statuses re-stamp, edited nodes read estimated. */
function finish(
  archetype: KitArchetype,
  recipe: ObjectRecipe,
  parts: ReadonlyArray<RecipePart>,
  touched: ReadonlySet<number>,
  evidence?: GraphEvidence
): EditResult {
  const solved = applyConstraints(archetype, { ...recipe, parts: parts.slice() });
  const graph = buildGraph(archetype, solved, evidence);
  const stamped = solved.parts.map((p, i) => ({
    ...p,
    status: touched.has(i) ? 'estimated' : graph.nodes[i]!.status,
  }));
  const out = { ...solved, parts: stamped };
  const regraph = buildGraph(archetype, out, evidence);
  regraph.nodes.forEach((n, i) => {
    if (touched.has(i)) n.status = 'estimated';
  });
  return { recipe: out, graph: regraph };
}
