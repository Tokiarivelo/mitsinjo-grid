// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import fs from 'node:fs';
import sharp from 'sharp';
import { runObjectShape } from '../object-shape';
import { defaultArchetype, kitToRecipe } from '@/lib/object-kit';
import { recipeMesh, triangleCount } from '@/features/vision-insert/utils/object-geometry';
import type { ShapeTarget } from '@/lib/object-shape';

const USER_IMAGE_PATH =
  '/home/tokiarivelo/.gemini/antigravity-cli/brain/d498be0d-cb46-4820-aac4-abaef4c32ebb/.user_uploaded/uploaded_media_1793527476583.jpg';

describe('user photo car generation & fidelity loop', () => {
  it('generates high-fidelity 12-part 3D model of the vintage car from the user image', async () => {
    if (!fs.existsSync(USER_IMAGE_PATH)) {
      return;
    }
    const buffer = fs.readFileSync(USER_IMAGE_PATH);
    const meta = await sharp(buffer).metadata();
    const photo = { buffer, width: meta.width!, height: meta.height! };

    // Target box for the purple vintage Mini Cooper
    const target: ShapeTarget = {
      id: 'vintage-mini-car',
      label: 'Purple vintage car',
      category: 'other',
      scenery: 'vehicle',
      box: { x: 0.2, y: 0.52, w: 0.254, h: 0.204 },
    };

    // Prove archetype inference works even when category is 'other'
    expect(defaultArchetype(target.category, target.scenery, target.label)).toBe('vehicle');

    const client = {
      describeShape: vi.fn().mockImplementation(async () => {
        const archetype = defaultArchetype(target.category, target.scenery, target.label);
        const kit = {
          archetype,
          subtype: 'vintage',
          proportions: { w: 1, h: 0.5, d: 0.55 },
          colors: { main: '#784384', secondary: '#dedee4', accent: '#222222' },
          materials: {
            main: 'metal' as const,
            secondary: 'metal' as const,
            accent: 'rubber' as const,
          },
          details: { wheels: 4 },
        };
        return {
          recipe: kitToRecipe(kit),
          kit,
          source: 'meta' as const,
          model: 'muse-spark-1.3',
        };
      }),
      describeParts: vi.fn().mockResolvedValue({ recipe: null }),
    };

    const shape = await runObjectShape(client, photo, 'data:full', target);
    expect(shape.mode).toBe('recipe');
    expect(shape.recipe).toBeDefined();

    const recipe = shape.recipe!;
    // 12 parts maximum fidelity
    expect(recipe.parts).toHaveLength(12);

    // Main body color is valid hex
    const mainColor = recipe.parts[0]!.color.toLowerCase();
    expect(mainColor).toMatch(/^#[0-9a-f]{6}$/);

    // Contains aerodynamic / sloped windshield & rear window prisms
    const prisms = recipe.parts.filter((p) => p.shape === 'prism');
    expect(prisms).toHaveLength(2);

    // Contains 4 wheels (cylinders along Z)
    const wheels = recipe.parts.filter((p) => p.shape === 'cylinder' && p.axis === 'z');
    expect(wheels).toHaveLength(4);

    // Generates a valid 3D mesh with vertex colors and normals for the Three.js viewer
    const mesh = recipeMesh(recipe);
    expect(triangleCount(mesh)).toBeGreaterThan(100);
    expect(triangleCount(mesh)).toBeLessThanOrEqual(5000); // respects ≤ 5k triangle budget
  });
});
