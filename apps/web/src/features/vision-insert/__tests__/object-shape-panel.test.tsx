import { fireEvent, render, screen, within } from '@testing-library/react';
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
const shape = (
  mode: ObjectShape['mode'],
  id = 'det-1',
  reason: NonNullable<ObjectShape['reason']> = 'no_body'
): ObjectShape => ({
  detectionId: id,
  mode,
  ...(mode === 'recipe'
    ? {
        recipe: {
          proportions: { w: 0.5, h: 1, d: 0.5 },
          parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#eeeeee' }],
        },
      }
    : { reason }),
  source: 'meta',
  model: 'muse-spark-1.3',
});

const renderPanel = (props: Partial<Parameters<typeof ObjectShapePanel>[0]> = {}) =>
  render(
    <I18nProvider>
      <ObjectShapePanel
        status="ready"
        shape={shape('recipe')}
        viewsStatus="idle"
        detection={fridge}
        label="Fridge"
        imageUrl="data:image/png;base64,AA"
        {...props}
      />
    </I18nProvider>
  );

const LABEL_KEYS = [
  'angleFront',
  'angleBack',
  'angleLeft',
  'angleRight',
  'angleTop',
  'angleThreeQuarter',
] as const;
const previewViews = (['front', 'back', 'left', 'right', 'top', 'three_quarter'] as const).map(
  (angle, i) => ({
    angle,
    labelKey: LABEL_KEYS[i]!,
    angleDeg: i * 60,
    description: `${angle} imagined`,
    imageUrl: 'data:image/png;base64,AA',
    features: ['hood', 'wheels'],
  })
);

describe('ObjectShapePanel (PV-T10)', () => {
  it('idle: « Not built yet » and the Generate button, no viewer', () => {
    const onGenerate = vi.fn();
    renderPanel({ status: 'idle', shape: undefined, onGenerate });
    expect(screen.getByText('Not built yet')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Generate the 3D model' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('the viewer sits on the studio backdrop (lighter than dark objects in both themes)', () => {
    renderPanel();
    expect(screen.getByRole('img', { name: '3D model of Fridge' }).className).toContain(
      'viewer-studio'
    );
  });

  it('loading: says the model is being built, no viewer yet', () => {
    renderPanel({ status: 'loading', shape: undefined });
    expect(screen.getByText('Building the 3D model…')).toBeTruthy();
    expect(screen.queryByText('viewer')).toBeNull();
  });

  it('loading shows the AI steps: done, current (with seconds and wait hint), to do', () => {
    renderPanel({ status: 'loading', shape: undefined, step: 'model', startedAt: Date.now() });
    const steps = screen.getByRole('list', { name: 'AI steps for the 3D model' });
    const items = within(steps).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]!.textContent).toContain('Extracting the object');
    expect(items[1]!.getAttribute('aria-current')).toBe('step');
    expect(items[1]!.textContent).toMatch(/Muse Spark imagines the parts.*0 s/);
    expect(items[2]!.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText(/usually needs 15 to 40 s \(limit 60 s\)/)).toBeTruthy();
  });

  it('recipe: AI badge, labelled viewer and the orbit hint', async () => {
    renderPanel();
    expect(screen.getByText('AI shape')).toBeTruthy();
    expect(screen.getByRole('img', { name: '3D model of Fridge' })).toBeTruthy();
    expect((await screen.findByText('viewer')).getAttribute('data-mode')).toBe('recipe');
    expect(screen.getByText('Drag to turn · pinch or scroll to zoom')).toBeTruthy();
  });

  it('silhouette: outline badge, why, and a retry button', async () => {
    const onRetry = vi.fn();
    renderPanel({ shape: shape('silhouette'), onRetry });
    expect(screen.getByText('Outline shape')).toBeTruthy();
    expect(
      screen.getByText("The AI shape could not be built: shown from the object's outline.")
    ).toBeTruthy();
    expect((await screen.findByText('viewer')).getAttribute('data-mode')).toBe('silhouette');
    fireEvent.click(screen.getByRole('button', { name: 'Try the AI shape again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('each fallback says its own cause; recipe mode has no retry', () => {
    const cases: Array<[NonNullable<ObjectShape['reason']>, RegExp]> = [
      ['provider_error', /The Meta model did not answer/],
      ['timeout', /Muse Spark took more than 60 s/],
      ['spend_cap', /spend cap is reached/],
      ['network', /app server could not be reached/],
    ];
    for (const [reason, text] of cases) {
      const { unmount } = renderPanel({
        shape: shape('silhouette', 'det-1', reason),
        onRetry: () => {},
      });
      expect(screen.getByText(text)).toBeTruthy();
      unmount();
    }
    const { unmount } = renderPanel({
      shape: { ...shape('silhouette', 'det-1', 'provider_error'), detail: 'http_429' },
    });
    expect(screen.getByText('Cause: HTTP 429')).toBeTruthy();
    unmount();
    renderPanel({ onRetry: () => {} });
    expect(screen.queryByRole('button', { name: 'Try the AI shape again' })).toBeNull();
  });

  it('a shape for another object is not shown (no stale model)', () => {
    renderPanel({ shape: shape('recipe', 'det-9') });
    expect(screen.getByText('Not built yet')).toBeTruthy();
    expect(screen.queryByText('viewer')).toBeNull();
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

  it('recipe: shows « Regenerate the 3D model » when onRegenerate is provided', () => {
    const onRegenerate = vi.fn();
    renderPanel({ onRegenerate });
    const btn = screen.getByRole('button', { name: 'Regenerate the 3D model' });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('idle: « Preview 6 angles » asks for the cheap 2D imagination first', () => {
    const onPreviewViews = vi.fn();
    renderPanel({ status: 'idle', shape: undefined, onPreviewViews, onGenerate: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Preview 6 angles of 2D imagination' }));
    expect(onPreviewViews).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('previewed: the 6 angles show with « Validate & Generate 3D model »', () => {
    const onGenerate = vi.fn();
    renderPanel({
      status: 'idle',
      shape: undefined,
      viewsStatus: 'ready',
      views: previewViews,
      onGenerate,
    });
    expect(screen.getByRole('tab', { name: 'Imagined 2D views (6 angles)' })).toBeTruthy();
    expect(screen.getByText('front imagined')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Back \(180°\)/ }));
    expect(screen.getByText('back imagined')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Validate & Generate 3D model' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('ready with views: tabs switch between the 3D model and the 6 angles', () => {
    renderPanel({
      shape: { ...shape('recipe'), imaginedViews: previewViews },
      viewsStatus: 'ready',
      views: previewViews,
    });
    // Model tab first: the viewer shows, the preview hides.
    expect(screen.getByText('viewer')).toBeTruthy();
    expect(screen.queryByText('front imagined')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Imagined 2D views (6 angles)' }));
    expect(screen.getByText('front imagined')).toBeTruthy();
    expect(screen.queryByText('viewer')).toBeNull();
    // Validated already: no second validate button on the views tab.
    expect(screen.queryByRole('button', { name: 'Validate & Generate 3D model' })).toBeNull();
  });

  it('statuses (PR-2.15): dims grouped by status + hidden note for inferred parts', () => {
    const s = shape('recipe');
    s.recipe = {
      proportions: { w: 1, h: 0.6, d: 0.5 },
      parts: [
        {
          shape: 'box',
          at: [0, 0, 0],
          size: [1, 1, 1],
          color: '#aaaaaa',
          front: true,
          status: 'estimated',
        },
        {
          shape: 'box',
          at: [0, 0, 0.505],
          size: [0.1, 0.1, 0.02],
          color: '#2222bb',
          status: 'measured',
        },
        {
          shape: 'box',
          at: [0, 0, -0.505],
          size: [0.1, 0.1, 0.02],
          color: '#2222bb',
          status: 'inferred',
        },
      ],
      dimStatus: { eave: 'measured', depth: 'estimated', yaw: 'estimated', scale: 'estimated' },
    };
    renderPanel({ shape: s });
    expect(
      screen.getByText('Dimensions: measured — roof · estimated — depth, orientation, scale')
    ).toBeTruthy();
    expect(screen.getByText('Parts: measured : 1 · estimated : 1 · inferred : 1')).toBeTruthy();
    expect(
      screen.getByText('Some parts are hidden in the photo: they are inferred, not measured.')
    ).toBeTruthy();
  });

  it('no statuses: no dims line, no hidden note', () => {
    renderPanel({ shape: shape('recipe') });
    expect(screen.queryByText(/Dimensions:/)).toBeNull();
    expect(screen.queryByText(/hidden in the photo/)).toBeNull();
  });
});
