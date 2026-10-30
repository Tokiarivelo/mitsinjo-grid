import {
  applyPatch,
  HardwareScaleSchema,
  scaleTelemetry,
  scenarios,
  simulate,
  TelemetryFrameSchema,
  toHardwareCommand,
} from '@mitsinjo/engine';
import type {
  BridgeMode,
  BridgeState,
  HardwareScale,
  ScenarioId,
  SimulationInput,
  StrategyId,
  TelemetryFrame,
  TelemetrySample,
} from '@mitsinjo/engine';

/** No frame for this long → the model counts as offline (firmware watchdog uses the same delay). */
export const DEVICE_TIMEOUT_MS = 5000;

export interface SimClock {
  day: number;
  hour: number;
}

/**
 * Simulated day and hour after `elapsedMs` of real time (1 simulated hour = timeScale seconds),
 * starting from `startH` simulated hours (where the clock was when the speed last changed).
 */
export function simClock(elapsedMs: number, timeScale: number, startH = 0): SimClock {
  const totalH = Math.floor(startH + Math.max(0, elapsedMs) / (timeScale * 1000));
  return { day: Math.floor(totalH / 24), hour: totalH % 24 };
}

export interface SessionOptions {
  mode: BridgeMode;
  scenarioId: ScenarioId;
  strategy: StrategyId;
  scale: HardwareScale;
}

/**
 * Bridge core without I/O: collects telemetry, runs the engine, builds the model's setpoints.
 * Every number comes from `@mitsinjo/engine`; this class only places frames on the simulated clock.
 */
export class BridgeSession {
  private readonly base: SimulationInput;
  private scale: HardwareScale;
  /** Real time and simulated hours at the last speed change: the clock goes on from there. */
  private anchorMs = 0;
  private anchorH = 0;
  private samples: TelemetrySample[] = [];
  private day = 0;
  private seq = 0;
  private lastFrameAt: number | null = null;

  constructor(private readonly opts: SessionOptions) {
    this.base = scenarios[opts.scenarioId].input;
    this.scale = HardwareScaleSchema.parse(opts.scale);
  }

  /** Validates a raw frame and stores it at the current simulated hour. Returns the frame or null. */
  ingest(raw: unknown, elapsedMs: number): TelemetryFrame | null {
    const parsed = TelemetryFrameSchema.safeParse(raw);
    if (!parsed.success) return null;
    this.lastFrameAt = elapsedMs;
    const { day, hour } = this.clock(elapsedMs);
    this.rollDay(day);
    if (this.opts.mode === 'twin') {
      this.samples.push({ simHour: hour, lux: parsed.data.lux, requests: parsed.data.requests });
    }
    return parsed.data;
  }

  /** Runs the engine for the current simulated hour and returns the state to publish. */
  tick(elapsedMs: number): BridgeState {
    const { day, hour } = this.clock(elapsedMs);
    this.rollDay(day);
    const patch =
      this.opts.mode === 'twin' ? scaleTelemetry(this.samples, this.scale, this.base) : {};
    const input = Object.keys(patch).length > 0 ? applyPatch(this.base, patch) : this.base;
    const result = simulate(input, this.opts.strategy);
    return {
      v: 1,
      mode: this.opts.mode,
      scenarioId: this.opts.scenarioId,
      strategy: this.opts.strategy,
      day,
      simHour: hour,
      patch,
      scale: this.scale,
      deviceOnline: this.lastFrameAt !== null && elapsedMs - this.lastFrameAt <= DEVICE_TIMEOUT_MS,
      command: toHardwareCommand(input, result, hour, this.scale, this.seq++),
    };
  }

  /**
   * Changes the speed (seconds per simulated hour) without jumping: the current day and hour stay,
   * only the pace of the next hours changes. Returns false for an out-of-range value.
   */
  setTimeScale(timeScale: number, elapsedMs: number): boolean {
    const next = HardwareScaleSchema.safeParse({ ...this.scale, timeScale });
    if (!next.success) return false;
    this.anchorH += Math.max(0, elapsedMs - this.anchorMs) / (this.scale.timeScale * 1000);
    this.anchorMs = Math.max(this.anchorMs, elapsedMs);
    this.scale = next.data;
    return true;
  }

  private clock(elapsedMs: number): SimClock {
    return simClock(elapsedMs - this.anchorMs, this.scale.timeScale, this.anchorH);
  }

  /** A new simulated day starts from the scenario again: measurements of the previous day are dropped. */
  private rollDay(day: number): void {
    if (day !== this.day) {
      this.day = day;
      this.samples = [];
    }
  }
}
