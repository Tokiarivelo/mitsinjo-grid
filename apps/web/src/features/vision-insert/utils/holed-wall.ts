import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WallHole } from './openings';

/**
 * A wall box with its openings really cut (PG-T11): each side face is a rectangle with
 * rectangular holes (triangulated by three's `ShapeGeometry`), and each hole gets its 4 reveal
 * faces going `depth` into the wall, where the glass or door leaf closes it. Top and bottom stay
 * whole. Non-indexed, position + normal + uv, centred like `BoxGeometry(w, h, d)`.
 */

type V3 = [number, number, number];

/** Margin kept between a hole and the face edge or another hole (world units). */
const EDGE = 1e-4;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Two triangles over p0..p3 (in order around the quad), wound to face `n`. */
function quad(p: [V3, V3, V3, V3], n: V3, pos: number[], nor: number[]) {
  const tris: Array<[V3, V3, V3]> = [
    [p[0], p[1], p[2]],
    [p[0], p[2], p[3]],
  ];
  for (const [a, b0, c0] of tris) {
    const flip = dot(cross(sub(b0, a), sub(c0, a)), n) < 0;
    const [b, c] = flip ? [c0, b0] : [b0, c0];
    pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) nor.push(...n);
  }
}

interface FaceHole {
  s: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

/** True when `a` and `b` overlap (with the edge margin). */
const overlap = (a: FaceHole, b: FaceHole) =>
  Math.abs(a.s - b.s) < (a.w + b.w) / 2 + EDGE && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + EDGE;

/**
 * One face in its own frame: the XY plane, surface at z = 0, outward +z, `width` × `height`
 * centred; holes inside it (others dropped), reveals going to z = −depth.
 */
function faceWithHoles(width: number, height: number, holes: FaceHole[]): THREE.BufferGeometry {
  const kept: FaceHole[] = [];
  for (const h of holes) {
    const inside =
      Math.abs(h.s) + h.w / 2 < width / 2 - EDGE && Math.abs(h.y) + h.h / 2 < height / 2 - EDGE;
    if (inside && h.w > 0 && h.h > 0 && !kept.some((k) => overlap(k, h))) kept.push(h);
  }
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();
  for (const h of kept) {
    const path = new THREE.Path();
    const [x0, x1, y0, y1] = [h.s - h.w / 2, h.s + h.w / 2, h.y - h.h / 2, h.y + h.h / 2];
    // Holes wound opposite to the outline.
    path.moveTo(x0, y0);
    path.lineTo(x0, y1);
    path.lineTo(x1, y1);
    path.lineTo(x1, y0);
    path.closePath();
    shape.holes.push(path);
  }
  const indexed = new THREE.ShapeGeometry(shape);
  const face = indexed.toNonIndexed();
  indexed.dispose();
  face.deleteAttribute('uv');
  const pos: number[] = [];
  const nor: number[] = [];
  for (const h of kept) {
    const [x0, x1, y0, y1, z] = [
      h.s - h.w / 2,
      h.s + h.w / 2,
      h.y - h.h / 2,
      h.y + h.h / 2,
      -h.depth,
    ];
    // Reveal faces look into the hole.
    quad(
      [
        [x0, y1, 0],
        [x1, y1, 0],
        [x1, y1, z],
        [x0, y1, z],
      ],
      [0, -1, 0],
      pos,
      nor
    );
    quad(
      [
        [x0, y0, 0],
        [x1, y0, 0],
        [x1, y0, z],
        [x0, y0, z],
      ],
      [0, 1, 0],
      pos,
      nor
    );
    quad(
      [
        [x0, y0, 0],
        [x0, y1, 0],
        [x0, y1, z],
        [x0, y0, z],
      ],
      [1, 0, 0],
      pos,
      nor
    );
    quad(
      [
        [x1, y0, 0],
        [x1, y1, 0],
        [x1, y1, z],
        [x1, y0, z],
      ],
      [-1, 0, 0],
      pos,
      nor
    );
  }
  if (!pos.length) return face;
  const reveals = new THREE.BufferGeometry();
  reveals.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  reveals.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const merged = mergeGeometries([face, reveals])!;
  face.dispose();
  reveals.dispose();
  return merged;
}

/** Wall box `w` × `h` × `d` with `holes` cut in its side faces (see `WallHole`). */
export function holedBox(
  w: number,
  h: number,
  d: number,
  holes: ReadonlyArray<WallHole>
): THREE.BufferGeometry {
  // Face frames: local s runs along the face so that, after the turn, it maps to the hole's u.
  const faces: Array<{ axis: 0 | 2; sign: 1 | -1; width: number; turn: number; flip: 1 | -1 }> = [
    { axis: 2, sign: 1, width: w, turn: 0, flip: 1 },
    { axis: 2, sign: -1, width: w, turn: Math.PI, flip: -1 },
    { axis: 0, sign: 1, width: d, turn: Math.PI / 2, flip: -1 },
    { axis: 0, sign: -1, width: d, turn: -Math.PI / 2, flip: 1 },
  ];
  const parts = faces.map((f) => {
    const own = holes
      .filter((hl) => hl.axis === f.axis && hl.sign === f.sign)
      .map((hl) => ({ s: hl.u * f.flip, y: hl.v, w: hl.w, h: hl.h, depth: hl.depth }));
    const g = faceWithHoles(f.width, h, own);
    g.rotateY(f.turn);
    const half = (f.axis === 2 ? d : w) / 2;
    if (f.axis === 2) g.translate(0, 0, f.sign * half);
    else g.translate(f.sign * half, 0, 0);
    return g;
  });
  for (const [turn, y] of [
    [-Math.PI / 2, h / 2],
    [Math.PI / 2, -h / 2],
  ] as const) {
    const indexed = new THREE.PlaneGeometry(w, d);
    const g = indexed.toNonIndexed();
    indexed.dispose();
    g.deleteAttribute('uv');
    g.rotateX(turn);
    g.translate(0, y, 0);
    parts.push(g);
  }
  const box = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  box.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(new Float32Array(box.getAttribute('position').count * 2), 2)
  );
  return box;
}
