import { describe, expect, it } from 'vitest';
import type { RecipePart } from '@/lib/object-shape';
import { EAVE_ROLL_SHARE, expandRoofTrim } from '../utils/roof-trim';
import { recipeMesh } from '../utils/object-geometry';

const P = { w: 1, h: 0.6, d: 0.5 };
const roof = (over: Partial<RecipePart> = {}): RecipePart => ({
  shape: 'hip',
  ridge: 0.8,
  at: [0, 0.3, 0],
  size: [1, 0.4, 1],
  color: '#c8a060',
  material: 'thatch',
  kind: 'roof',
  ...over,
});

describe('expandRoofTrim (PG-T12)', () => {
  it('a thatched hip roof gets a roll on each of its 4 eaves, roof colour', () => {
    const parts = expandRoofTrim([roof()], P);
    const rolls = parts.filter((p) => p.shape === 'cylinder');
    expect(rolls).toHaveLength(4);
    expect(rolls.every((r) => r.color === '#c8a060' && r.material === 'thatch')).toBe(true);
    expect(rolls.filter((r) => r.axis === 'x')).toHaveLength(2);
  });

  it('rolls sit on the eave line: front roll at the roof front, near the roof foot', () => {
    const [, front] = expandRoofTrim([roof()], P);
    const roofH = 0.4 * P.h;
    const r = EAVE_ROLL_SHARE * roofH;
    expect(front!.at[2] * P.d).toBeCloseTo(0.5 * P.d, 6);
    const foot = (0.3 - 0.2) * P.h;
    expect(front!.at[1] * P.h).toBeCloseTo(foot + 0.6 * r, 6);
    expect(front!.size[1] * P.h).toBeCloseTo(2 * r, 6);
  });

  it('a gable prism gets 2 rolls along its long sides, past the overhang', () => {
    const rolls = expandRoofTrim([roof({ shape: 'prism', apex: 0.5 })], P, 0.03).filter(
      (p) => p.shape === 'cylinder'
    );
    expect(rolls).toHaveLength(2);
    expect(rolls.every((r) => r.axis === 'z')).toBe(true);
    expect(Math.abs(rolls[0]!.at[0] * P.w)).toBeCloseTo(0.5 + 0.03, 6);
  });

  it('slate, tile and other parts are left alone', () => {
    const parts = [roof({ material: 'slate' }), { ...roof(), shape: 'box' as const }];
    expect(expandRoofTrim(parts, P)).toEqual(parts);
  });

  it('the mesh grows by the rolls and stays in budget', () => {
    const plain = recipeMesh({ proportions: P, parts: [roof({ material: 'slate' })] });
    const thatch = recipeMesh({ proportions: P, parts: [roof()] });
    expect(thatch.getAttribute('position').count).toBeGreaterThan(
      plain.getAttribute('position').count
    );
    expect(thatch.getAttribute('position').count / 3).toBeLessThan(5_000);
  });
});
