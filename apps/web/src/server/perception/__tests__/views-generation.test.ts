// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { CANONICAL_ANGLES } from '@/lib/object-shape';
import { defaultArchetype, kitToRecipe } from '@/lib/object-kit';
import { generateImaginedViews, getAngleAnatomy } from '../views-generation';

describe('6-angle 2D imagination views (views-generation)', () => {
  it('provides anatomical feature descriptions for all 6 angles of a vehicle', () => {
    for (const angle of CANONICAL_ANGLES) {
      const anatomy = getAngleAnatomy('vehicle', angle);
      expect(anatomy.description.length).toBeGreaterThan(10);
      expect(anatomy.features.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('generates 6 crisp 2D imagined angle views as PNG data URLs', async () => {
    const target = {
      label: 'Purple vintage car',
      category: 'other' as const,
      scenery: 'vehicle' as const,
    };
    const archetype = defaultArchetype(target.category, target.scenery, target.label);
    const kit = {
      archetype,
      proportions: { w: 1, h: 0.5, d: 0.55 },
      colors: { main: '#784384', secondary: '#dedee4', accent: '#222222' },
      materials: { main: 'metal' as const, secondary: 'glass' as const, accent: 'rubber' as const },
    };
    const recipe = kitToRecipe(kit);

    const views = await generateImaginedViews(recipe, target, 1.2, 64);
    expect(views).toHaveLength(6);

    const angles = views.map((v) => v.angle);
    expect(angles).toEqual(CANONICAL_ANGLES);

    for (const v of views) {
      expect(v.imageUrl).toMatch(/^data:image\/png;base64,/);
      expect(v.features.length).toBeGreaterThan(0);
      expect(v.labelKey).toMatch(/^angle[A-Z]/);
    }
  });
});
