import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import type { ObjectShape } from '@/lib/object-shape';
import type { ApplianceDetection } from '@/lib/vision';

const webgl = vi.hoisted(() => ({ on: true }));
vi.mock('@/features/microgrid-3d', () => ({ useWebGLAvailable: () => webgl.on }));
vi.mock('../ui/object-editor-3d', () => ({
  ObjectEditor3d: ({ shape }: { shape: ObjectShape }) => <div data-mode={shape.mode}>viewer</div>,
}));

import { ObjectShapePanel } from '../ui/object-shape-panel';

const fridge: ApplianceDetection = {
  id: 'det-1',
  label: 'Fridge',
  category: 'fridge',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 },
};
const shape = (mode: ObjectShape['mode'], id = 'det-1'): ObjectShape => ({
  detectionId: id,
  mode,
  ...(mode === 'recipe'
    ? {
        recipe: {
          proportions: { w: 0.5, h: 1, d: 0.5 },
          parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#eeeeee' }],
        },
      }
    : { reason: 'proportions' }),
  source: 'meta',
  model: 'muse-spark-1.3',
});

const renderPanel = (props: Partial<Parameters<typeof ObjectShapePanel>[0]> = {}) =>
  render(
    <I18nProvider>
      <ObjectShapePanel
        status="ready"
        shape={shape('recipe')}
        detection={fridge}
        label="Fridge"
        imageUrl="data:image/png;base64,AA"
        {...props}
      />
    </I18nProvider>
  );

describe('ObjectShapePanel (PV-T10)', () => {
  it('loading: says the model is being built, no viewer yet', () => {
    renderPanel({ status: 'loading', shape: undefined });
    expect(screen.getByText('Building the 3D model…')).toBeTruthy();
    expect(screen.queryByText('viewer')).toBeNull();
  });

  it('recipe: AI badge, labelled viewer and the orbit hint', async () => {
    renderPanel();
    expect(screen.getByText('AI shape')).toBeTruthy();
    expect(screen.getByRole('img', { name: '3D model of Fridge' })).toBeTruthy();
    expect((await screen.findByText('viewer')).getAttribute('data-mode')).toBe('recipe');
    expect(screen.getByText('Drag to turn · pinch or scroll to zoom')).toBeTruthy();
  });

  it('silhouette: outline badge and why', async () => {
    renderPanel({ shape: shape('silhouette') });
    expect(screen.getByText('Outline shape')).toBeTruthy();
    expect(
      screen.getByText("The AI shape was not usable: built from the object's outline.")
    ).toBeTruthy();
    expect((await screen.findByText('viewer')).getAttribute('data-mode')).toBe('silhouette');
  });

  it('a shape for another object counts as still loading (no stale model)', () => {
    renderPanel({ shape: shape('recipe', 'det-9') });
    expect(screen.getByText('Building the 3D model…')).toBeTruthy();
  });

  it('no WebGL: a note instead of the viewer', () => {
    webgl.on = false;
    renderPanel();
    expect(
      screen.getByText('The 3D view needs WebGL. The photo stays the reference.')
    ).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    webgl.on = true;
  });
});
