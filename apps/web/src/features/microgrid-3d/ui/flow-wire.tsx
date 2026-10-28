import { useMemo } from 'react';
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
        <g fill="currentColor" filter={glow} data-electrons={count}>
          {Array.from({ length: count }, (_, j) => {
            if (!animate) {
              const [x, y] = sampleArcPath(path, j / count, [0, 0]);
              return <circle key={j} cx={x} cy={y} r={1.7} />;
            }
            return (
              <circle key={j} r={1.7}>
                <animateMotion
                  path={d}
                  dur={`${period.toFixed(2)}s`}
                  begin={`${(-(period * j) / count).toFixed(2)}s`}
                  repeatCount="indefinite"
                  keyPoints={reverse ? '1;0' : '0;1'}
                  keyTimes="0;1"
                  calcMode="linear"
                />
              </circle>
            );
          })}
        </g>
      )}
    </g>
  );
}
