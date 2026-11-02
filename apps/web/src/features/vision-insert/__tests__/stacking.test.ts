import { describe, expect, it } from 'vitest';
import { paintOrder, pickAt } from '../utils/stacking';

const house = { id: 'house', box: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 } };
const lamp = { id: 'lamp', box: { x: 0.44, y: 0.48, w: 0.016, h: 0.11 } };
const door = { id: 'door', box: { x: 0.4, y: 0.4, w: 0.1, h: 0.25 } };

describe('box stacking on the photo', () => {
  it('paints the biggest first so small boxes are on top (stable for equal areas)', () => {
    expect(paintOrder([lamp, house, door]).map((d) => d.id)).toEqual(['house', 'door', 'lamp']);
    const twin = { id: 'twin', box: house.box };
    expect(paintOrder([house, twin]).map((d) => d.id)).toEqual(['house', 'twin']);
  });

  it('a click picks the smallest box there; again on the same spot = the next one under it', () => {
    const all = [house, door, lamp];
    const p: [number, number] = [0.45, 0.5];
    expect(pickAt(all, p, null)).toBe('lamp');
    expect(pickAt(all, p, 'lamp')).toBe('door');
    expect(pickAt(all, p, 'door')).toBe('house');
    expect(pickAt(all, p, 'house')).toBe('lamp');
    // Selected box elsewhere: start from the smallest here.
    expect(pickAt(all, [0.2, 0.2], 'lamp')).toBe('house');
    expect(pickAt(all, [0.9, 0.9], null)).toBeNull();
  });
});
