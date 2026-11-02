import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Appliance } from '@mitsinjo/engine';
import { ApplianceMarkers, MarkerDragGhost } from '../ui/appliance-markers';
import { applianceMarkers } from '../utils/appliance-markers';
import { SECTOR_POSITIONS } from '../utils/to-scene-model';

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Instance: ({
    position,
    onClick,
    onPointerDown,
  }: {
    position: [number, number, number];
    onClick?: unknown;
    onPointerDown?: unknown;
  }) => (
    <div
      data-testid="mock-instance"
      data-position={JSON.stringify(position)}
      data-bound={onClick && onPointerDown ? '1' : ''}
    />
  ),
  Line: ({
    points,
    segments,
  }: {
    points: { x: number; y: number; z: number }[];
    segments?: boolean;
  }) => (
    <div
      data-testid="mock-line"
      data-segments={segments ? '1' : ''}
      data-count={points.length}
      data-p0={JSON.stringify({ x: points[0]!.x, y: points[0]!.y, z: points[0]!.z })}
      data-p1={JSON.stringify({ x: points[1]!.x, y: points[1]!.y, z: points[1]!.z })}
    />
  ),
}));

const pump: Appliance = {
  id: 'p1',
  name: 'Pump',
  category: 'water_pump',
  sector: 'water',
  watts: 750,
  quantity: 2,
};

describe('ApplianceMarkers UI (PP-T3)', () => {
  it('no markers → nothing', () => {
    const { container } = render(
      <ApplianceMarkers markers={[]} selectedSector={null} tagOf={(m) => m.name} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('instances sit on the ground height; one batched Line links marker tops to feeders', () => {
    const markers = applianceMarkers(
      [pump, { ...pump, id: 'p2', position: { x: 30, z: 30 } }],
      SECTOR_POSITIONS,
      12
    );
    render(<ApplianceMarkers markers={markers} selectedSector={null} tagOf={(m) => m.name} />);
    // Plinth of the first marker: ground + half plinth height (0.12 / 2).
    const instances = screen.getAllByTestId('mock-instance');
    const y0 = (JSON.parse(instances[0]!.dataset.position!) as number[])[1]!;
    expect(y0).toBeCloseTo(markers[0]!.position[1] + 0.06, 9);
    // Feeder links: one segments batch, 2 points per marker, top → feeder anchor.
    const lines = screen.getAllByTestId('mock-line');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.dataset.segments).toBe('1');
    expect(Number(lines[0]!.dataset.count)).toBe(markers.length * 2);
    const p0 = JSON.parse(lines[0]!.dataset.p0!) as { x: number; y: number; z: number };
    const p1 = JSON.parse(lines[0]!.dataset.p1!) as { x: number; y: number; z: number };
    expect(p0.x).toBeCloseTo(markers[0]!.position[0], 9);
    expect(p0.y).toBeCloseTo(markers[0]!.position[1] + 0.62, 9);
    expect(p1.x).toBeCloseTo(markers[0]!.feeder[0], 9);
    expect(p1.y).toBeCloseTo(markers[0]!.feeder[1], 9);
  });
});

describe('ApplianceMarkers drag UI (PP-T5)', () => {
  const markers = applianceMarkers(
    [pump, { ...pump, id: 'p2', position: { x: 30, z: 30 } }],
    SECTOR_POSITIONS,
    12
  );

  it('selection ring + cyan tag on the selected marker only', () => {
    const { container } = render(
      <ApplianceMarkers
        markers={markers}
        selectedSector={null}
        tagOf={(m) => m.name}
        selectedId="p1"
      />
    );
    expect(container.querySelector('mesh[name="appliance-selection-ring"]')).not.toBeNull();
    const tag1 = container.querySelector('[data-appliance-tag="p1"]')!;
    const tag2 = container.querySelector('[data-appliance-tag="p2"]')!;
    expect(tag1.className).toContain('border-energy-cyan');
    expect(tag2.className).toContain('border-border');
    expect(tag2.className).not.toContain('border-energy-cyan');
  });

  it('no ring without a matching selection', () => {
    const { container, rerender } = render(
      <ApplianceMarkers markers={markers} selectedSector={null} tagOf={(m) => m.name} />
    );
    expect(container.querySelector('mesh[name="appliance-selection-ring"]')).toBeNull();
    rerender(
      <ApplianceMarkers
        markers={markers}
        selectedSector={null}
        tagOf={(m) => m.name}
        selectedId="nope"
      />
    );
    expect(container.querySelector('mesh[name="appliance-selection-ring"]')).toBeNull();
  });

  it('dragged marker hides: instances, tag and feeder link', () => {
    const { container } = render(
      <ApplianceMarkers markers={markers} selectedSector={null} tagOf={(m) => m.name} dragId="p1" />
    );
    // One plinth + one body instance per marker: the dragged one is gone.
    expect(screen.getAllByTestId('mock-instance')).toHaveLength(2);
    expect(container.querySelector('[data-appliance-tag="p1"]')).toBeNull();
    expect(container.querySelector('[data-appliance-tag="p2"]')).not.toBeNull();
    const lines = screen.getAllByTestId('mock-line');
    expect(lines).toHaveLength(1);
    expect(Number(lines[0]!.dataset.count)).toBe(2);
  });

  it('bindMarker handlers reach every instance; inert without them', () => {
    const bound = render(
      <ApplianceMarkers
        markers={markers}
        selectedSector={null}
        tagOf={(m) => m.name}
        bindMarker={() => ({ onClick: vi.fn(), onPointerDown: vi.fn() })}
      />
    );
    for (const inst of screen.getAllByTestId('mock-instance')) {
      expect(inst.dataset.bound).toBe('1');
    }
    bound.unmount();
    render(<ApplianceMarkers markers={markers} selectedSector={null} tagOf={(m) => m.name} />);
    for (const inst of screen.getAllByTestId('mock-instance')) {
      expect(inst.dataset.bound).toBe('');
    }
  });

  it('MarkerDragGhost renders a translucent plinth + body pair', () => {
    const ghostRef = { current: null } as React.RefObject<THREE.Group | null>;
    const { container } = render(<MarkerDragGhost ghostRef={ghostRef} visible />);
    const ghost = container.querySelector('group[name="appliance-drag-ghost"]')!;
    expect(ghost).not.toBeNull();
    expect(ghost.querySelectorAll(':scope > mesh')).toHaveLength(2);
  });
});
