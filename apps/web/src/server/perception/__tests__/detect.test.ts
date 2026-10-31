import { describe, expect, it } from 'vitest';
import { gridBoxToNorm, MAX_DETECTIONS, parseDetections, toApplianceCategory } from '../detect';
import { ApplianceDetectionSchema } from '../schemas';

const reply = (objects: unknown[]) => JSON.stringify({ objects });

describe('parseDetections (PV-T4)', () => {
  it('maps a Muse reply to normalized detections with stable ids', () => {
    const out = parseDetections(
      reply([
        { label: 'Fridge', category: 'fridge', bbox: [100, 200, 300, 900], confidence: 0.9 },
        { label: 'TV', category: 'tv', bbox: [400, 300, 700, 550] },
      ])
    );
    expect(out).toEqual([
      {
        id: 'det-1',
        label: 'Fridge',
        category: 'fridge',
        confidence: 0.9,
        box: { x: 0.1, y: 0.2, w: 0.2, h: 0.7 },
      },
      { id: 'det-2', label: 'TV', category: 'tv', box: { x: 0.4, y: 0.3, w: 0.3, h: 0.25 } },
    ]);
    for (const d of out) expect(ApplianceDetectionSchema.safeParse(d).success).toBe(true);
  });

  it('clamps boxes to the 0–1000 grid and fixes swapped corners', () => {
    expect(gridBoxToNorm([-50, 900, 1200, 1100])).toEqual({ x: 0, y: 0.9, w: 1, h: 0.1 });
    expect(gridBoxToNorm([600, 500, 200, 100])).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.4 });
    expect(gridBoxToNorm([10, 10, 10, 50])).toBeNull(); // zero width
    expect(gridBoxToNorm([1, 2, 3])).toBeNull();
    expect(gridBoxToNorm([1, 2, 'x', 4])).toBeNull();
    expect(gridBoxToNorm([1100, 0, 1500, 100])).toBeNull(); // fully outside → empty
  });

  it('maps out-of-enum categories to aliases or other', () => {
    expect(toApplianceCategory('Refrigerator')).toBe('fridge');
    expect(toApplianceCategory('light bulb')).toBe('lamp');
    expect(toApplianceCategory('phone-charger')).toBe('phone_charger');
    expect(toApplianceCategory('microwave')).toBe('other');
    expect(toApplianceCategory(42)).toBe('other');
    const [d] = parseDetections(
      reply([{ label: 'Microwave', category: 'microwave', bbox: [0, 0, 10, 10] }])
    );
    expect(d!.category).toBe('other');
    expect(d!.label).toBe('Microwave');
  });

  it('skips malformed objects, fixes confidence scale and empty labels, caps the count', () => {
    const out = parseDetections(
      reply([
        null,
        'fridge',
        { label: 'no box', category: 'fan' },
        { label: '  ', category: 'fan', bbox: [0, 0, 100, 100], confidence: 85 },
        { label: 'x'.repeat(60), category: 'lamp', bbox: [0, 0, 100, 100], confidence: -1 },
      ])
    );
    expect(out.map((d) => [d.id, d.label.length, d.confidence])).toEqual([
      ['det-1', 3, 0.85],
      ['det-2', 40, undefined],
    ]);
    expect(out[0]!.label).toBe('fan');
    const many = Array.from({ length: 30 }, () => ({
      label: 'l',
      category: 'lamp',
      bbox: [0, 0, 9, 9],
    }));
    expect(parseDetections(reply(many))).toHaveLength(MAX_DETECTIONS);
  });

  it('accepts a fenced JSON reply and an empty list', () => {
    expect(parseDetections('```json\n{"objects": []}\n```')).toEqual([]);
  });

  it('throws on a malformed reply so the client can fall back', () => {
    expect(() => parseDetections('I see a fridge.')).toThrow(/not valid JSON/);
    expect(() => parseDetections('{"items": []}')).toThrow();
    expect(() => parseDetections('')).toThrow();
  });

  it('never carries a power value, even if the model adds one', () => {
    const [d] = parseDetections(
      reply([
        { label: 'Pump', category: 'water_pump', bbox: [0, 0, 500, 500], watts: 750, kw: 0.75 },
      ])
    );
    expect(Object.keys(d!).sort()).toEqual(['box', 'category', 'id', 'label']);
  });
});
