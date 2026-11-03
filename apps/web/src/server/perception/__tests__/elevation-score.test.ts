import { describe, expect, it } from 'vitest';
import { fitRecipe, type ObjectRecipe } from '@/lib/object-shape';
import {
  elevationBox,
  elevationTarget,
  matchOpenings,
  partConcept,
  renderElevation,
  renderLabels,
  scoreElevation,
  ELEVATION_CONCEPTS,
  DIFF_COLORS,
  elevationDiff,
  formatElevationScore,
  sideFacing,
} from '../elevation-score';
import { DOOR_COLOR, facadeHouseRecipe, measureElevation } from '../facade-house';
import { THATCHED_FRONT } from '../__fixtures__/elevation';

const THATCHED = THATCHED_FRONT.masks;
const ROOF_RING = THATCHED.roof!.rings![0]!;
const COLORS = THATCHED_FRONT.colors;

const front = () => measureElevation(THATCHED)!;
const built = (): ObjectRecipe =>
  fitRecipe(
    { ...facadeHouseRecipe({ front: front(), side: null, colors: COLORS }), source: 'facade' },
    0,
    0.3
  );

describe('elevation render (PG-T1)', () => {
  it('draws the built house back onto its own drawing (walls, eave, base, ground ±1.5 px)', () => {
    const e = front();
    const r = renderElevation(built(), e);
    const labels = renderLabels(built(), r);
    const wall = ELEVATION_CONCEPTS.indexOf('wall');
    let [c0, c1, r0, r1] = [Infinity, -Infinity, Infinity, -Infinity];
    labels.forEach((v, i) => {
      if (v !== wall) return;
      const c = i % r.cols;
      const row = (i - c) / r.cols;
      [c0, c1, r0, r1] = [Math.min(c0, c), Math.max(c1, c), Math.min(r0, row), Math.max(r1, row)];
    });
    const tol = 1.5;
    expect(Math.abs(c0 - e.wallLeft * r.cols)).toBeLessThan(tol + 0.5);
    expect(Math.abs(c1 + 1 - e.wallRight * r.cols)).toBeLessThan(tol + 0.5);
    // The wall stops on the stone base, the base stands on the ground.
    expect(Math.abs(r1 + 1 - e.plinth!.y * r.rows)).toBeLessThan(tol + 0.5);
    const plinth = ELEVATION_CONCEPTS.indexOf('plinth');
    const baseRows = Array.from(labels).flatMap((v, i) =>
      v === plinth ? [Math.floor(i / r.cols)] : []
    );
    expect(Math.abs(Math.max(...baseRows) + 1 - e.bottom * r.rows)).toBeLessThan(tol + 0.5);
    // The top of the visible wall is the eave (the roof overhang hides nothing above it).
    expect(Math.abs(r0 - e.eave * r.rows)).toBeLessThan(tol + 0.5);
  });

  it('ignores the photo yaw: the drawing is straight on', () => {
    const e = front();
    const a = renderElevation({ ...built(), yaw: 0 }, e);
    const b = renderElevation({ ...built(), yaw: 0.4 }, e);
    expect(Array.from(a.part)).toEqual(Array.from(b.part));
  });

  it('frames the object box with chimneys on the grid', () => {
    const box = elevationBox(front());
    expect(box.y).toBeCloseTo(0.119, 3);
    expect(box.x + box.w).toBeCloseTo(0.839, 3);
  });

  it('side view puts the front on the image left', () => {
    const r = renderElevation(built(), front(), 'side');
    expect(r.mask.data.some((v) => v)).toBe(true);
  });
});

describe('part concepts', () => {
  it('reads roof, window, chimney, door and wall from the facade builder', () => {
    const concepts = built().parts.map(partConcept);
    expect(concepts).toContain('roof');
    expect(concepts).toContain('wall');
    expect(concepts.filter((c) => c === 'window')).toHaveLength(2);
    expect(concepts.filter((c) => c === 'chimney')).toHaveLength(2);
    expect(concepts.filter((c) => c === 'door')).toHaveLength(1);
    expect(
      partConcept({
        shape: 'box',
        at: [0, 0, 0],
        size: [1, 1, 1],
        color: DOOR_COLOR,
        material: 'wood',
      })
    ).toBe('door');
  });
});

describe('elevation score (PG-T2)', () => {
  it('scores the facade builder high on its own drawing, every opening matched', () => {
    const s = scoreElevation(built(), front(), { roofRings: [ROOF_RING] });
    expect(s.iou).toBeGreaterThan(0.9);
    expect(s.openings.matched).toBe(3);
    expect(s.openings.centreError).toBeLessThan(0.02);
    expect(s.concepts.window).toBeGreaterThan(0.6);
    expect(s.stages.massing).toBeGreaterThan(0.85);
    expect(s.score).toBeGreaterThan(80);
  });

  it('is deterministic', () => {
    const a = scoreElevation(built(), front());
    const b = scoreElevation(built(), front());
    expect({ ...a, render: null, target: null }).toEqual({ ...b, render: null, target: null });
  });

  it('drops when the windows are missing (openings stage)', () => {
    const r = built();
    const noWindows = { ...r, parts: r.parts.filter((p) => p.material !== 'glass') };
    const good = scoreElevation(r, front());
    const bad = scoreElevation(noWindows, front());
    expect(bad.openings.matched).toBe(1);
    expect(bad.stages.openings).toBeLessThan(good.stages.openings - 0.3);
    expect(bad.score).toBeLessThan(good.score);
  });

  it('drops when the roof is missing (roof stage)', () => {
    const r = built();
    const flat = { ...r, parts: r.parts.filter((p) => partConcept(p) !== 'roof') };
    const s = scoreElevation(flat, front());
    expect(s.stages.roof).toBe(0);
    expect(s.score).toBeLessThan(scoreElevation(r, front()).score - 15);
  });

  it('drops when the chimneys are missing (accessories stage)', () => {
    const r = built();
    const bare = { ...r, parts: r.parts.filter((p) => p.material !== 'brick') };
    expect(scoreElevation(bare, front()).stages.accessories).toBe(0);
  });
});

describe('elevation target', () => {
  it('paints openings over the wall and the roof outline inside its band', () => {
    const t = elevationTarget(front(), 128, [ROOF_RING]);
    const at = (x: number, y: number) =>
      ELEVATION_CONCEPTS[t.label[Math.floor(y * t.rows) * t.cols + Math.floor(x * t.cols)]!];
    expect(at(0.31, 0.62)).toBe('window');
    expect(at(0.5, 0.7)).toBe('door');
    expect(at(0.3, 0.75)).toBe('wall');
    expect(at(0.5, 0.35)).toBe('roof');
    // Above the ridge corner, outside the trapezoid.
    expect(at(0.17, 0.24)).toBeUndefined();
    expect(t.openings).toHaveLength(3);
  });
});

describe('matchOpenings', () => {
  const b = (x: number, y: number) => ({ x, y, w: 0.1, h: 0.1 });
  it('pairs the closest same-concept openings one to one', () => {
    const m = matchOpenings(
      [
        { concept: 'window', box: b(0.1, 0.5) },
        { concept: 'window', box: b(0.7, 0.5) },
      ],
      [
        { concept: 'window', box: b(0.72, 0.5) },
        { concept: 'door', box: b(0.1, 0.5) },
      ],
      1,
      1
    );
    expect(m.matched).toBe(1);
    expect(m.centreError).toBeCloseTo(0.02, 5);
    expect(m.score).toBeLessThan(0.6);
  });
  it('is perfect with nothing on either side', () => {
    expect(matchOpenings([], [], 1.5, 0.5).score).toBe(1);
  });
});

describe('elevation diff + log (PG-T4)', () => {
  it('paints missing windows red and the matched walls grey', () => {
    const r = built();
    const noWindows = { ...r, parts: r.parts.filter((p) => p.material !== 'glass') };
    const s = scoreElevation(noWindows, front());
    const d = elevationDiff(noWindows, s);
    const px = (x: number, y: number) => {
      const i = (Math.floor(y * d.rows) * d.cols + Math.floor(x * d.cols)) * 3;
      return Array.from(d.rgb.slice(i, i + 3));
    };
    // The wall shows through where the window was: built, but the wrong concept.
    expect(px(0.31, 0.62)).toEqual([...DIFF_COLORS.wrong]);
    expect(px(0.3, 0.75)).toEqual([...DIFF_COLORS.both]);
    expect(px(0.02, 0.02)).toEqual([...DIFF_COLORS.none]);
    expect(formatElevationScore(s)).toMatch(
      /^elevation \d+\/100 .*openings 1\/3 drawn, 1 built\)$/
    );
  });
});

describe('inferred base on a drawing without one (live 2026-11-02)', () => {
  it('scores the base as wall foot, not as a missing concept', () => {
    const { plinths: _p, steps: _s, ...bare } = THATCHED;
    const e = measureElevation(bare)!;
    expect(e.plinth).toBeNull();
    const withBase = fitRecipe(
      {
        ...facadeHouseRecipe({ front: e, side: null, colors: COLORS, details: { plinth: true } }),
        source: 'facade',
      },
      0
    );
    const s = scoreElevation(withBase, e);
    expect(s.concepts.plinth).toBeUndefined();
    expect(s.stages.massing).toBeGreaterThan(0.85);
  });
});

describe('side-wall openings on the front elevation', () => {
  it('count as wall, never as built openings (before: the loop removed side windows, 2026-11-03)', () => {
    const base = built();
    // A side window as the builder places it: thin along x, just proud of the right wall.
    const wallPart = base.parts.find((p) => p.kind === 'wall')!;
    const sideWin = {
      ...base.parts.find((p) => p.kind === 'window')!,
      at: [wallPart.at[0] + wallPart.size[0] / 2 + 0.005, -0.27, 0] as [number, number, number],
      size: [0.01, 0.14, 0.13] as [number, number, number],
    };
    expect(sideFacing(sideWin)).toBe(true);
    expect(sideFacing(base.parts.find((p) => p.kind === 'window')!)).toBe(false);
    const opts = { roofRings: [ROOF_RING] };
    const without = scoreElevation(base, front(), opts);
    const withSide = scoreElevation({ ...base, parts: [...base.parts, sideWin] }, front(), opts);
    expect(withSide.openings.render).toBe(without.openings.render);
    expect(withSide.stages.openings).toBeCloseTo(without.stages.openings, 2);
  });
});
