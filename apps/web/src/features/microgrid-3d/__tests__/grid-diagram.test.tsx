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
  APPLIANCE_BRANCH_SLOTS,
  applianceBranchRoute,
  applianceBranchSlots,
  boxesOverlap,
  diagramLayout,
  segmentCrossesBox,
  type Box,
  type DiagramLayout,
} from '../utils/diagram-layout';

const allBoxes = (l: DiagramLayout): Box[] => [
  l.boxes.solar,
  l.boxes.hub,
  l.boxes.controller,
  l.busLabel,
  ...DIAGRAM_SECTORS.map((id) => l.boxes.sectors[id]),
  ...DIAGRAM_SECTORS.map((id) => l.feederTags[id]),
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
      ...(l.wires.controllerToBus ? [l.wires.controllerToBus] : []),
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

  it('topology routes the hub feed through the EMS controller before the bus', () => {
    const l = diagramLayout('topology');
    const c = l.boxes.controller;
    const [hx, hy] = l.wires.hubToBus.at(-1)!;
    const [ox, oy] = l.wires.controllerToBus![0]!;
    expect(hy).toBe(c.y);
    expect(oy).toBe(c.y + c.h);
    expect(hx).toBeGreaterThan(c.x);
    expect(ox).toBeLessThan(c.x + c.w);
    expect(l.wires.controllerToBus!.at(-1)![1]).toBe(l.busBar[0][1]);
  });

  it('circuit keeps the bus bar and every breaker inside the EMS switchboard', () => {
    const l = diagramLayout('circuit');
    const e = l.enclosure!;
    const inside = ([x, y]: [number, number]) =>
      x > e.x && x < e.x + e.w && y > e.y && y < e.y + e.h;
    expect(inside(l.busBar[0]) && inside(l.busBar[1])).toBe(true);
    for (const id of DIAGRAM_SECTORS) expect(inside(l.breakers![id]), id).toBe(true);
    expect(e.y + e.h).toBeLessThanOrEqual(DIAGRAM_H);
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
    // solar (night: idle), hub → EMS, EMS → bus, one line per sector
    expect(states).toHaveLength(3 + SECTOR_IDS.length);
    expect(states.filter((s) => s === 'cut').length).toBeGreaterThanOrEqual(1);

    for (const g of container.querySelectorAll('[data-wire-state]')) {
      const hasElectrons = g.querySelector('[data-electrons]') !== null;
      const state = g.getAttribute('data-wire-state');
      expect(hasElectrons).toBe(state === 'flow' || state === 'lifeline');
    }
  });

  it('draws lifeline feeders as amber wires that still carry electrons (PL-T12)', () => {
    const result = simulate(stress, 'essential_first');
    const hour = result.steps.findIndex((s) =>
      Object.values(s.sectors).some((sec) => sec.mode === 'lifeline' && sec.servedKw > 0)
    );
    expect(hour).toBeGreaterThanOrEqual(0);
    const model = toSceneModel({ input: stress, result, timeIndex: hour });
    const { container } = render(
      <I18nProvider>
        <GridDiagram model={model} variant="topology" />
      </I18nProvider>
    );
    const lifeline = container.querySelectorAll('[data-wire-state="lifeline"]');
    expect(lifeline.length).toBeGreaterThanOrEqual(1);
    for (const g of lifeline) {
      expect(g.getAttribute('class')).toContain('text-warning-amber');
      expect(g.querySelector('[data-electrons]')).not.toBeNull();
    }
    expect(screen.getAllByText('Lifeline').length).toBeGreaterThanOrEqual(1);
  });

  it('draws breakers in the circuit view and reports sector clicks', () => {
    const { container, onSelect } = renderDiagram('circuit', 12);
    expect(screen.getByRole('group', { name: /Single-line circuit/i })).toBeInTheDocument();
    expect(container.querySelector('[data-variant="circuit"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Water/i }));
    expect(onSelect).toHaveBeenCalledWith('water');
  });

  it('renders a legend that explains the electrons, lifeline, and limiter (PL-T12)', () => {
    renderDiagram('topology', 12);
    const legend = screen.getByRole('list', { name: 'Diagram legend' });
    expect(within(legend).getByText('Current flowing (electrons)')).toBeInTheDocument();
    expect(within(legend).getByText('Lifeline (survival mode)')).toBeInTheDocument();
    expect(within(legend).getByText('Limiter active (lifeline)')).toBeInTheDocument();
  });

  it('renders building cards with mode badge and power metrics (PL-T12)', () => {
    renderDiagram('topology', 12);
    // Each connected sector card displays its mode badge (Full / Limited / Lifeline / Off)
    const badges = screen.getAllByText(/Full|Limited|Lifeline|Off/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // Displays served / demand kW on cards
    const waterCard = screen.getByRole('button', { name: /Water/i });
    expect(within(waterCard).getAllByText(/kW/i).length).toBeGreaterThanOrEqual(1);
  });

  it('zooms with the zoom buttons and resets (diagram zoom)', () => {
    const { container } = renderDiagram('circuit', 12);
    const controls = screen.getByRole('group', { name: 'Diagram zoom' });
    const zoomOut = within(controls).getByRole('button', { name: 'Zoom out' });
    const reset = within(controls).getByRole('button', { name: 'Reset zoom' });
    expect(zoomOut).toBeDisabled();
    fireEvent.click(within(controls).getByRole('button', { name: 'Zoom in' }));
    expect(container.querySelector('[data-zoom]')!.getAttribute('data-zoom')).toBe('1.25');
    expect(zoomOut).toBeEnabled();
    fireEvent.click(reset);
    expect(container.querySelector('[data-zoom]')!.getAttribute('data-zoom')).toBe('1.00');
  });

  it.each(['topology', 'circuit'] as const)(
    '%s shows the kW sent on each connected feeder',
    (v) => {
      const { model } = renderDiagram(v, 12);
      const tags = screen.getAllByRole('img', { name: /kW/ });
      const connected = SECTOR_IDS.filter((id) => model.buildings[id].connected);
      expect(tags).toHaveLength(connected.length);
    }
  );

  it('renders the EMS dispatch controller block with mode and rule tooltip in topology and circuit (PL-T6)', () => {
    const topo = renderDiagram('topology', 12);
    expect(
      topo.container.querySelector('[aria-label*="EMS Dispatch Controller"]')
    ).toBeInTheDocument();

    const circuit = renderDiagram('circuit', 12);
    expect(
      circuit.container.querySelector('[aria-label*="EMS Dispatch Controller"]')
    ).toBeInTheDocument();
  });
});

describe('GridDiagram appliances (PV-T13, PI-T9)', () => {
  it('a sector fed by inserted appliances shows « n added »', () => {
    const input = {
      ...stress,
      appliances: [
        {
          id: 'a',
          name: 'Pump',
          category: 'water_pump' as const,
          sector: 'water' as const,
          watts: 750,
          quantity: 1,
        },
        {
          id: 'b',
          name: 'Pump 2',
          category: 'water_pump' as const,
          sector: 'water' as const,
          watts: 750,
          quantity: 1,
        },
      ],
    };
    const model = toSceneModel({ input, result: simulate(input, 'proportional'), timeIndex: 12 });
    render(
      <I18nProvider>
        <GridDiagram model={model} variant="topology" onSelectSector={vi.fn()} />
      </I18nProvider>
    );
    expect(screen.getByText(/2 added/)).toBeTruthy();
    expect(screen.getAllByText(/added/)).toHaveLength(1);
  });

  it('applianceBranchRoute never passes under any label box across all sectors and modes (PI-T9)', () => {
    const variants = ['topology', 'circuit'] as const;
    const modes = ['branch', 'ems'] as const;
    for (const v of variants) {
      const layout = diagramLayout(v);
      const boxes = allBoxes(layout);
      for (const sector of DIAGRAM_SECTORS) {
        for (const mode of modes) {
          // Every slot, plus one past the cap (clamped): stays clear and inside the viewBox.
          for (let slot = 0; slot <= APPLIANCE_BRANCH_SLOTS; slot++) {
            const route = applianceBranchRoute(sector, mode, v, layout, slot);
            for (const [x, y] of route.points) {
              expect(x >= 0 && x <= DIAGRAM_W && y >= 0 && y <= DIAGRAM_H).toBe(true);
            }
            for (let k = 1; k < route.points.length; k++) {
              for (const b of boxes) {
                expect(
                  segmentCrossesBox(route.points[k - 1]!, route.points[k]!, b),
                  `${v}/${sector}/${mode}/slot ${slot}`
                ).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  it('applianceBranchSlots stacks per sector (EMS shared) and caps the slot (PR #57 review)', () => {
    const list = [
      { id: 'w1', sector: 'water' as const },
      { id: 'h1', sector: 'health' as const },
      { id: 'w2', sector: 'water' as const },
      { id: 'e1', sector: 'water' as const, connectionMode: 'ems' as const },
      { id: 'e2', sector: 'school' as const, connectionMode: 'ems' as const },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, sector: 'market' as const })),
    ];
    const slots = applianceBranchSlots(list);
    expect([slots.w1, slots.h1, slots.w2, slots.e1, slots.e2]).toEqual([0, 0, 1, 0, 1]);
    expect(slots.m9).toBe(APPLIANCE_BRANCH_SLOTS - 1);
  });

  it('draws branch wire and terminal node in branch and ems modes with electrons (PI-T9)', () => {
    const input = {
      ...stress,
      appliances: [
        {
          id: 'branch-app',
          name: 'Vaccine fridge',
          category: 'fridge_vaccine' as const,
          sector: 'health' as const,
          watts: 120,
          quantity: 1,
        },
        {
          id: 'ems-app',
          name: 'Solar pump',
          category: 'water_pump' as const,
          sector: 'water' as const,
          watts: 750,
          quantity: 1,
        },
      ],
    };
    const placedModels = {
      'branch-app': { connectionMode: 'branch' as const },
      'ems-app': { connectionMode: 'ems' as const },
    };
    const model = toSceneModel({
      input,
      result: simulate(input, 'proportional'),
      timeIndex: 12,
      placedModels,
    });
    const { container } = render(
      <I18nProvider>
        <GridDiagram model={model} variant="topology" onSelectSector={vi.fn()} />
      </I18nProvider>
    );

    // Both appliances are rendered on the diagram
    const branchElem = screen.getByTestId('diagram-appliance-branch-app');
    const emsElem = screen.getByTestId('diagram-appliance-ems-app');
    expect(branchElem.getAttribute('data-connection-mode')).toBe('branch');
    expect(emsElem.getAttribute('data-connection-mode')).toBe('ems');

    // Wires carry electron animation when active
    const branchWire = container.querySelector('[data-appliance-branch="branch-app"]');
    const emsWire = container.querySelector('[data-appliance-branch="ems-app"]');
    expect(branchWire).not.toBeNull();
    expect(emsWire).not.toBeNull();
    expect(branchWire?.querySelector('[data-electrons]')).not.toBeNull();
    expect(emsWire?.querySelector('[data-electrons]')).not.toBeNull();
  });
});
