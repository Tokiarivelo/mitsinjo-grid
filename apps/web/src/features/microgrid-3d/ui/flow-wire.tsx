import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LineFlowSceneModel } from '../types';
import type { Pt } from '../utils/diagram-layout';
import {
  buildArcPath,
  electronCount,
  electronPeriodS,
  sampleArcPath,
  toSvgPath,
} from '../utils/flow-path';

export type WireState = 'flow' | 'cut' | 'idle';

export interface FlowWireProps {
  points: Pt[];
  line: LineFlowSceneModel;
  /** `cut` = demand present but nothing served (shed); `idle` = no current, no demand. */
  state: WireState;
  /** Tailwind text color class; wire and electrons use `currentColor`. */
  colorClass: string;
  /** False under reduced motion: electrons are drawn but don't move. */
  animate: boolean;
  /** `url(#id)` of the diagram's glow filter. */
  glow: string;
}

/** One dot every ~11 user units of wire. */
const SPACING = 11;
/** Line `speed` (0.5–2.5) → user units per second. */
const SPEED_SCALE = 22;

/** A 2D cable: dark conductor, lit core and moving electrons when powered, red dashes when cut. */
export function FlowWire({ points, line, state, colorClass, animate, glow }: FlowWireProps) {
  const d = useMemo(() => toSvgPath(points), [points]);
  const path = useMemo(() => buildArcPath(points), [points]);
  const flowing = state === 'flow';
  const count = flowing ? electronCount(path.total, SPACING, 2, 16) : 0;
  const period = electronPeriodS(path.total, line.speed * SPEED_SCALE);
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

  return (
    <g
      data-wire-state={state}
      className={cn(flowing || state === 'cut' ? colorClass : 'text-border-strong')}
    >
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
            strokeOpacity={0.25}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
        </>
      ) : (
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeDasharray={state === 'cut' ? '3 3' : undefined}
          strokeOpacity={state === 'cut' ? 0.8 : 0.6}
          strokeLinejoin="round"
        />
      )}

      {state === 'cut' && (
        // Break mark in the middle of a shed line.
        <g transform={`translate(${mid[0]} ${mid[1]})`} stroke="currentColor" strokeWidth={1.6}>
          <circle r={4.5} className="fill-canvas" strokeWidth={1} />
          <line x1={-2.2} y1={-2.2} x2={2.2} y2={2.2} />
          <line x1={-2.2} y1={2.2} x2={2.2} y2={-2.2} />
        </g>
      )}

      {count > 0 && (
        <g ref={groupRef} fill="currentColor" filter={glow} data-electrons={count}>
          {initialPositions.map(([x, y], j) => (
            <circle key={j} cx={x} cy={y} r={1.7} />
          ))}
        </g>
      )}
    </g>
  );
}
