import { useEffect, useMemo, useRef } from 'react';
import type { LineFlowSceneModel } from '../types';
import type { Pt } from '../utils/diagram-layout';
import {
  buildArcPath,
  electronCount,
  electronPeriodS,
  sampleArcPath,
  toSvgPath,
} from '../utils/flow-path';

export type WireState = 'flow' | 'lifeline' | 'cut' | 'idle';

export interface FlowWireProps {
  points: Pt[];
  line: LineFlowSceneModel;
  /** `lifeline` = survival mode (amber dashed); `cut` = shed (grey dashed); `idle` = no demand. */
  state: WireState;
  /** Tailwind text color class; wire and electrons use `currentColor`. */
  colorClass: string;
  /** False under reduced motion: electrons are drawn but don't move. */
  animate: boolean;
  /** `url(#id)` of the diagram's glow filter. */
  glow: string;
  /** Feeder intensity 0..1 to scale stroke width, opacity, and particles (PL-T11/PL-T12). */
  intensity?: number;
}

/** Base electron spacing (user units of wire) modulated by intensity. */
const BASE_SPACING = 14;
/** Line `speed` (0.5–2.5) → user units per second. */
const SPEED_SCALE = 22;

/** A 2D cable: conductor, lit core and moving electrons scaled by feeder intensity (PL-T11/PL-T12). */
export function FlowWire({
  points,
  line,
  state,
  colorClass,
  animate,
  glow,
  intensity,
}: FlowWireProps) {
  const d = useMemo(() => toSvgPath(points), [points]);
  const path = useMemo(() => buildArcPath(points), [points]);
  const flowing = state === 'flow';
  const isLifeline = state === 'lifeline';

  // Intensity 0..1 for visual scaling
  const effectiveIntensity = Math.min(
    1,
    Math.max(
      0.1,
      intensity ?? (line.flowKw > 0 ? Math.min(1, Math.max(0.2, line.flowKw / 3)) : 0.5)
    )
  );

  // Density ∝ kW / intensity: lifeline has 1-2 dots, full has more
  const count = flowing
    ? electronCount(path.total, BASE_SPACING - 5 * effectiveIntensity, 2, 14)
    : isLifeline
      ? electronCount(path.total, 24, 1, 3)
      : 0;

  // Speed ∝ kW / intensity
  const speed =
    line.speed * (0.7 + 0.6 * effectiveIntensity) * (isLifeline ? 0.5 : 1) * SPEED_SCALE;
  const period = electronPeriodS(path.total, Math.max(5, speed));
  const reverse = line.direction === 'backward';

  const mid = useMemo(() => sampleArcPath(path, 0.5, [0, 0]), [path]);

  // Persistent continuous phase ref so dots don't snap back to 0 when line.speed / period changes.
  const phaseRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const groupRef = useRef<SVGGElement>(null);
  const periodRef = useRef(period);
  const reverseRef = useRef(reverse);
  const pathRef = useRef(path);

  useEffect(() => {
    periodRef.current = period;
    reverseRef.current = reverse;
    pathRef.current = path;
  }, [period, reverse, path]);

  // Pre-calculate initial positions for each dot
  const initialPositions = useMemo(() => {
    if (count === 0) return [];
    return Array.from({ length: count }, (_, j) => {
      const [x, y] = sampleArcPath(path, j / count, [0, 0]);
      return [x, y] as [number, number];
    });
  }, [path, count]);

  useEffect(() => {
    if (!animate || count === 0) return;
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
    const group = groupRef.current;
    if (!group) return;
    const circles = group.querySelectorAll('circle');
    if (!circles.length) return;

    let animId: number;
    const scratch = [0, 0];

    const step = (time: number) => {
      if (lastTimeRef.current != null) {
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
        const p = periodRef.current;
        if (p > 0 && isFinite(p)) {
          phaseRef.current = (phaseRef.current + dt / p) % 1;
        }
      }
      lastTimeRef.current = time;

      const base = phaseRef.current;
      const rev = reverseRef.current;
      const currentPath = pathRef.current;
      const n = circles.length;

      for (let j = 0; j < n; j++) {
        const circle = circles[j];
        if (!circle) continue;
        const phase = base + j / n;
        sampleArcPath(currentPath, rev ? -phase : phase, scratch);
        circle.setAttribute('cx', scratch[0]!.toFixed(1));
        circle.setAttribute('cy', scratch[1]!.toFixed(1));
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animId);
      lastTimeRef.current = null;
    };
  }, [animate, count]);

  // Color: lifeline is warning-amber; cut lines are text-muted (gris); idle is border-strong
  const wireColorClass = isLifeline
    ? 'text-warning-amber'
    : state === 'cut'
      ? 'text-text-muted'
      : flowing
        ? colorClass
        : 'text-border-strong';

  // Dynamic stroke widths & opacities ∝ intensity (PL-T12)
  const coreStrokeWidth = isLifeline ? 1.5 : Number((1.1 + 1.1 * effectiveIntensity).toFixed(2));
  const coreStrokeOpacity = isLifeline ? 0.9 : Number((0.5 + 0.5 * effectiveIntensity).toFixed(2));
  const haloStrokeWidth = Number((3 + 3 * effectiveIntensity).toFixed(2));
  const haloStrokeOpacity = isLifeline
    ? 0.15
    : Number((0.1 + 0.22 * effectiveIntensity).toFixed(2));
  const electronRadius = isLifeline ? 1.2 : Number((1.3 + 0.6 * effectiveIntensity).toFixed(2));

  return (
    <g data-wire-state={state} className={wireColorClass}>
      <path
        d={d}
        fill="none"
        className="stroke-canvas-sunken"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {flowing ? (
        <>
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeOpacity={haloStrokeOpacity}
            strokeWidth={haloStrokeWidth}
            strokeLinejoin="round"
          />
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={coreStrokeWidth}
            strokeOpacity={coreStrokeOpacity}
            strokeLinejoin="round"
          />
        </>
      ) : isLifeline ? (
        <>
          {/* État survie en ambre pointillé avec halo discret (PL-T12) */}
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeOpacity={haloStrokeOpacity}
            strokeWidth={haloStrokeWidth}
            strokeLinejoin="round"
          />
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={coreStrokeWidth}
            strokeDasharray="4 4"
            strokeOpacity={coreStrokeOpacity}
            strokeLinejoin="round"
          />
        </>
      ) : (
        /* Fil coupé gris pointillé ou fil inactif (PL-T11 / PL-T12) */
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeDasharray={state === 'cut' ? '3 3' : undefined}
          strokeOpacity={state === 'cut' ? 0.6 : 0.4}
          strokeLinejoin="round"
        />
      )}

      {state === 'cut' && (
        // Break mark discret en fil coupé gris (PL-T11)
        <g transform={`translate(${mid[0]} ${mid[1]})`} stroke="currentColor" strokeWidth={1.4}>
          <circle r={4} className="fill-canvas" strokeWidth={0.8} />
          <line x1={-2} y1={-2} x2={2} y2={2} />
          <line x1={-2} y1={2} x2={2} y2={-2} />
        </g>
      )}

      {count > 0 && (
        <g ref={groupRef} fill="currentColor" filter={glow} data-electrons={count}>
          {initialPositions.map(([x, y], j) => (
            <circle key={j} cx={x} cy={y} r={electronRadius} />
          ))}
        </g>
      )}
    </g>
  );
}
