import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SECTOR_IDS, scenarios, simulate } from '@mitsinjo/engine';
import { I18nProvider } from '@/lib/i18n';
import { GridDiagram } from '../ui/grid-diagram';
import { toSceneModel } from '../utils/to-scene-model';
import {
  DIAGRAM_H,
  DIAGRAM_SECTORS,
  DIAGRAM_W,
  boxesOverlap,
  diagramLayout,
  segmentCrossesBox,
  type Box,
  type DiagramLayout,
} from '../utils/diagram-layout';

const allBoxes = (l: DiagramLayout): Box[] => [
  l.boxes.solar,
  l.boxes.hub,
  l.busLabel,
  ...DIAGRAM_SECTORS.map((id) => l.boxes.sectors[id]),
];

const stress = scenarios.essential_stress.input;
const stressResult = simulate(stress, 'proportional');

function renderDiagram(variant: 'topology' | 'circuit', hour: number, onSelect = vi.fn()) {
  const model = toSceneModel({ input: stress, result: stressResult, timeIndex: hour });
  const utils = render(
    <I18nProvider>
      <GridDiagram model={model} variant={variant} onSelectSector={onSelect} />
    </I18nProvider>
  );
  return { ...utils, model, onSelect };
}

describe('diagramLayout', () => {
  const variants = ['topology', 'circuit'] as const;

  it.each(variants)('%s keeps every label box inside the viewBox', (v) => {
    const l = diagramLayout(v);
    for (const b of allBoxes(l)) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(DIAGRAM_W);
      expect(b.y + b.h).toBeLessThanOrEqual(DIAGRAM_H);
    }
  });

  it.each(variants)('%s: no two label boxes overlap', (v) => {
    const boxes = allBoxes(diagramLayout(v));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boxesOverlap(boxes[i]!, boxes[j]!), `boxes ${i} and ${j}`).toBe(false);
      }
    }
  });

  it.each(variants)('%s: no wire passes under a label box', (v) => {
    const l = diagramLayout(v);
    const wires = [
      l.wires.solarToHub,
      l.wires.hubToBus,
      l.busBar,
      ...DIAGRAM_SECTORS.map((id) => l.wires.busToSector[id]),
    ];
    for (const w of wires) {
      for (let k = 1; k < w.length; k++) {
        for (const b of allBoxes(l)) {
          expect(segmentCrossesBox(w[k - 1]!, w[k]!, b)).toBe(false);
        }
      }
    }
  });

  it('ends each feeder on its sector box edge', () => {
    for (const v of variants) {
      const l = diagramLayout(v);
      for (const id of DIAGRAM_SECTORS) {
        const [x, y] = l.wires.busToSector[id].at(-1)!;
        const b = l.boxes.sectors[id];
        const onEdge =
          ((x === b.x || x === b.x + b.w) && y >= b.y && y <= b.y + b.h) ||
          ((y === b.y || y === b.y + b.h) && x >= b.x && x <= b.x + b.w);
        expect(onEdge, `${v}/${id}`).toBe(true);
      }
    }
    expect(diagramLayout('circuit').breakers).toBeDefined();
    expect(diagramLayout('topology').breakers).toBeUndefined();
  });

  it('detects overlaps and crossings', () => {
    const b = { x: 0, y: 0, w: 10, h: 10 };
    expect(boxesOverlap(b, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(boxesOverlap(b, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(segmentCrossesBox([-5, 5], [15, 5], b)).toBe(true);
    expect(segmentCrossesBox([-5, 10], [15, 10], b)).toBe(false);
  });
});

describe('GridDiagram', () => {
  it('shows electrons on powered lines and a cut mark on shed sectors', () => {
    const { container, model } = renderDiagram('topology', 20);
    expect(model.buildings.health.status).toBe('unserved');
    const health = screen.getByRole('button', { name: /Health/i });
    expect(within(health).getByText('Cut')).toBeInTheDocument();

    const states = Array.from(container.querySelectorAll('[data-wire-state]')).map((g) =>
      g.getAttribute('data-wire-state')
    );
    // solar (night: idle), feeder, one line per sector
    expect(states).toHaveLength(2 + SECTOR_IDS.length);
    expect(states.filter((s) => s === 'cut').length).toBeGreaterThanOrEqual(1);

    for (const g of container.querySelectorAll('[data-wire-state]')) {
      const hasElectrons = g.querySelector('[data-electrons]') !== null;
      expect(hasElectrons).toBe(g.getAttribute('data-wire-state') === 'flow');
    }
  });

  it('draws breakers in the circuit view and reports sector clicks', () => {
    const { container, onSelect } = renderDiagram('circuit', 12);
    expect(screen.getByRole('group', { name: /Single-line circuit/i })).toBeInTheDocument();
    expect(container.querySelector('[data-variant="circuit"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Water/i }));
    expect(onSelect).toHaveBeenCalledWith('water');
  });

  it('renders a legend that explains the electrons', () => {
    renderDiagram('topology', 12);
    const legend = screen.getByRole('list', { name: 'Diagram legend' });
    expect(within(legend).getByText('Current flowing (electrons)')).toBeInTheDocument();
  });
});
