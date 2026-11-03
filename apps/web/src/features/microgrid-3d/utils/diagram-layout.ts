/**
 * Pure 2D layouts for the microgrid diagrams. Both views draw the same wires as
 * the 3D scene (solar → hub → bus → each sector); only positions and routes differ.
 * Every label has a reserved box and wires stop at box edges, so nothing overlaps
 * or hides a cable (checked by tests). Units: SVG user units in DIAGRAM_W × DIAGRAM_H.
 */
import { SECTOR_IDS, type SectorId } from '@mitsinjo/engine';

export type DiagramVariant = 'topology' | 'circuit';
export type Pt = [number, number];
/** Top-left corner + size. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DIAGRAM_W = 320;
export const DIAGRAM_H = 200;

/** Every engine sector, in the engine's display order. */
export const DIAGRAM_SECTORS: readonly SectorId[] = SECTOR_IDS;

export interface DiagramLayout {
  boxes: { solar: Box; hub: Box; controller: Box; sectors: Record<SectorId, Box> };
  /**
   * `hubToBus` ends on the EMS controller when power passes through it (topology:
   * hub → controller → bus, then `controllerToBus`).
   */
  wires: {
    solarToHub: Pt[];
    hubToBus: Pt[];
    controllerToBus?: Pt[];
    busToSector: Record<SectorId, Pt[]>;
  };
  /** kW tag beside each feeder wire (power the controller sends to that sector). */
  feederTags: Record<SectorId, Box>;
  /** Circuit only: EMS switchboard frame around the bus bar and breakers. */
  enclosure?: Box;
  /** Distribution bus bar; feeders leave from points on it. */
  busBar: [Pt, Pt];
  /** Where the bus name + power label sits (top-left of a BUS_LABEL box). */
  busLabel: Box;
  /** Circuit only: one breaker per feeder. */
  breakers?: Record<SectorId, Pt>;
}

const box = (cx: number, cy: number, w: number, h: number): Box => ({
  x: cx - w / 2,
  y: cy - h / 2,
  w,
  h,
});

/**
 * Village plan seen from above, same relative places as the 3D scene: solar NW,
 * school N, factory NE, health E, water W, households SW, market S, hub in the middle.
 */
function topologyLayout(): DiagramLayout {
  const SW = 72;
  const SH = 30;
  const busY = 128;
  const solar = box(46, 27, 68, 28);
  const hub = box(150, 74, 76, 32);
  // On the hub → bus path: every feeder leaves through the EMS controller.
  const controller = box(150, 110, 62, 24);
  const sectors: Record<SectorId, Box> = {
    school: box(196, 26, SW, SH),
    industry: box(284, 26, SW, SH),
    health: box(272, 92, SW, SH),
    water: box(43, busY, 66, SH),
    households: box(118, 178, SW, SH),
    market: box(222, 178, SW, SH),
  };
  const bottom = (b: Box): number => b.y + b.h;
  const busToSector: Record<SectorId, Pt[]> = {
    water: [
      [100, busY],
      [sectors.water.x + sectors.water.w, busY],
    ],
    households: [
      [118, busY],
      [118, sectors.households.y],
    ],
    market: [
      [222, busY],
      [222, sectors.market.y],
    ],
    // Up the east side, clear of the clinic box.
    industry: [
      [314, busY],
      [314, bottom(sectors.industry)],
    ],
    school: [
      [208, busY],
      [208, bottom(sectors.school)],
    ],
    health: [
      [272, busY],
      [272, bottom(sectors.health)],
    ],
  };
  return {
    boxes: { solar, hub, controller, sectors },
    wires: {
      solarToHub: [
        [46, bottom(solar)],
        [46, 74],
        [hub.x, 74],
      ],
      hubToBus: [
        [150, bottom(hub)],
        [150, controller.y],
      ],
      controllerToBus: [
        [150, bottom(controller)],
        [150, busY],
      ],
      busToSector,
    },
    // Beside each feeder, clear of its wire and of every card.
    feederTags: {
      water: { x: 76, y: busY - 12, w: 24, h: 9 },
      households: { x: 120, y: busY + 12, w: 24, h: 9 },
      market: { x: 224, y: busY + 12, w: 24, h: 9 },
      school: { x: 210, y: 60, w: 24, h: 9 },
      health: { x: 246, y: busY - 16, w: 24, h: 9 },
      industry: { x: 288, y: 50, w: 24, h: 9 },
    },
    busBar: [
      [100, busY],
      [314, busY],
    ],
    busLabel: { x: 160, y: busY + 5, w: 54, h: 11 },
  };
}

/** Single-line diagram: sources left, vertical bus bar, one breaker + feeder per sector. */
function circuitLayout(): DiagramLayout {
  const busX = 132;
  const cardX = 206;
  const firstY = 28;
  // Rows shrink to fit every sector in the viewBox (36 units for 5 sectors).
  const rowH = Math.min(36, (DIAGRAM_H - firstY - 18) / Math.max(1, DIAGRAM_SECTORS.length - 1));
  const lastY = firstY + (DIAGRAM_SECTORS.length - 1) * rowH;
  const solar = box(52, 40, 76, 30);
  const hub = box(52, 120, 76, 40);
  // Header tab of the EMS switchboard that holds the bus bar and every breaker.
  const controller = box(152, 11, 58, 20);
  const sectors = {} as Record<SectorId, Box>;
  const busToSector = {} as Record<SectorId, Pt[]>;
  const breakers = {} as Record<SectorId, Pt>;
  const feederTags = {} as Record<SectorId, Box>;
  DIAGRAM_SECTORS.forEach((id, i) => {
    const y = firstY + i * rowH;
    // Narrow enough to leave a column on the right for inserted appliances.
    sectors[id] = { x: cardX, y: y - 14, w: 72, h: 28 };
    breakers[id] = [166, y];
    // Just outside the switchboard, above the outgoing feeder.
    feederTags[id] = { x: 182, y: y - 11, w: 22, h: 9 };
    busToSector[id] = [
      [busX, y],
      [cardX, y],
    ];
  });
  return {
    boxes: { solar, hub, controller, sectors },
    wires: {
      solarToHub: [
        [52, solar.y + solar.h],
        [52, hub.y],
      ],
      hubToBus: [
        [hub.x + hub.w, 120],
        [busX, 120],
      ],
      busToSector,
    },
    feederTags,
    enclosure: {
      x: controller.x - 1,
      y: controller.y + controller.h / 2,
      w: controller.w + 1,
      h: lastY + 14 - (controller.y + controller.h / 2),
    },
    busBar: [
      [busX, firstY - 6],
      [busX, lastY + 8],
    ],
    busLabel: { x: 66, y: 6, w: 52, h: 14 },
    breakers,
  };
}

export function diagramLayout(variant: DiagramVariant): DiagramLayout {
  return variant === 'circuit' ? circuitLayout() : topologyLayout();
}

/** True when two boxes share any area (touching edges don't count). */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** True when an axis-aligned segment passes through a box's interior. */
export function segmentCrossesBox([x1, y1]: Pt, [x2, y2]: Pt, b: Box): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return minX < b.x + b.w && maxX > b.x && minY < b.y + b.h && maxY > b.y;
}

/** Stacked branch slots per sector and mode; extra appliances share the last slot. */
export const APPLIANCE_BRANCH_SLOTS = 3;

/**
 * Slot of each appliance among those on the same sector and connection mode (PI-T9),
 * capped so every route stays inside the diagram and clear of every label box.
 */
export function applianceBranchSlots(
  appliances: readonly { id: string; sector: SectorId; connectionMode?: 'branch' | 'ems' }[]
): Record<string, number> {
  const seen = new Map<string, number>();
  const slots: Record<string, number> = {};
  for (const a of appliances) {
    const group = a.connectionMode === 'ems' ? 'ems' : a.sector;
    const n = seen.get(group) ?? 0;
    seen.set(group, n + 1);
    slots[a.id] = Math.min(n, APPLIANCE_BRANCH_SLOTS - 1);
  }
  return slots;
}

export interface ApplianceBranchRoute {
  points: Pt[];
  node: Pt;
  tap: Pt;
}

/**
 * 2D branch wire route for an inserted appliance (PI-T9).
 * - Mode 'branch': branches off the feeder wire of its sector.
 * - Mode 'ems': runs directly from the EMS controller.
 * Positions are chosen to avoid passing through any card, tag or bus label.
 */
export function applianceBranchRoute(
  sector: SectorId,
  mode: 'branch' | 'ems',
  variant: DiagramVariant,
  layout: DiagramLayout,
  slot = 0
): ApplianceBranchRoute {
  const index = Math.min(Math.max(0, slot), APPLIANCE_BRANCH_SLOTS - 1);
  if (variant === 'circuit') {
    if (mode === 'ems') {
      const start: Pt = [181, 10];
      const node: Pt = [194, 10 + index * 3];
      return {
        tap: start,
        node,
        points: [start, node],
      };
    }
    const y = layout.wires.busToSector[sector][0]![1];
    const tapX = 174;
    const nodeY = y + 8 + index * 4;
    const node: Pt = [188, nodeY];
    return {
      tap: [tapX, y],
      node,
      points: [[tapX, y], [tapX, nodeY], node],
    };
  }

  // Topology variant
  if (mode === 'ems') {
    const start: Pt = [181, 110];
    const node: Pt = [196, 108 + index * 8];
    return {
      tap: start,
      node,
      points: [start, node],
    };
  }

  switch (sector) {
    case 'water': {
      const tap: Pt = [88, 128];
      const node: Pt = [88, 146 + index * 8];
      return { tap, node, points: [tap, node] };
    }
    case 'households': {
      const tapY = 145 + index * 6;
      const tap: Pt = [118, tapY];
      const node: Pt = [104, tapY];
      return { tap, node, points: [tap, node] };
    }
    case 'market': {
      const tapY = 145 + index * 6;
      const tap: Pt = [222, tapY];
      const node: Pt = [208, tapY];
      return { tap, node, points: [tap, node] };
    }
    case 'school': {
      const tapY = 80 + index * 8;
      const tap: Pt = [208, tapY];
      const node: Pt = [222, tapY];
      return { tap, node, points: [tap, node] };
    }
    case 'industry': {
      const tap: Pt = [314, 118];
      const node: Pt = [302, 118 - index * 4];
      return { tap, node, points: [tap, node] };
    }
    case 'health': {
      const tap: Pt = [272, 118];
      const node: Pt = [286, 118 - index * 4];
      return { tap, node, points: [tap, node] };
    }
  }
}
