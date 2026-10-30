import { z } from 'zod';
import {
  BreakerStateSchema,
  ControllerModeSchema,
  FeederToneSchema,
  ScenarioIdSchema,
  SectorIdSchema,
  sectorRecordSchema,
  StrategyIdSchema,
} from './common';
import { InputPatchSchema } from './input';

/**
 * Physical scale model (PH): how its watts and seconds map to the simulated grid.
 * `powerScale` 4000 → 1 W on the model = 4 kW simulated; `timeScale` 20 → 1 simulated hour = 20 s.
 */
export const HardwareScaleSchema = z.object({
  powerScale: z.number().min(1).max(100_000),
  timeScale: z.number().min(1).max(3600),
  /** Reference-sensor lux under the "sun" lamp with no cloud = a clear-sky hour. */
  luxFullSun: z.number().positive().max(200_000),
  /** Model power (W) of each feeder at 100 % duty. */
  nominalW: sectorRecordSchema(z.number().min(0).max(50)),
});
export type HardwareScale = z.infer<typeof HardwareScaleSchema>;

/** Raw INA3221 channel reading. */
export const ChannelReadingSchema = z.object({
  mV: z.number().min(0).max(30_000),
  mA: z.number().min(-5000).max(5000),
});
export type ChannelReading = z.infer<typeof ChannelReadingSchema>;

/** One frame published by the model's microcontroller (~1 Hz). */
export const TelemetryFrameSchema = z.object({
  v: z.literal(1),
  deviceId: z.string().min(1).max(64),
  seq: z.number().int().min(0),
  uptimeMs: z.number().int().min(0),
  lux: z.number().min(0).max(200_000),
  pv: ChannelReadingSchema,
  /** Physical buffer battery: safety only, never shown as the grid SoC. */
  battery: ChannelReadingSchema,
  /** Current after each feeder MOSFET = what is served (check only, never demand). */
  feeders: sectorRecordSchema(ChannelReadingSchema),
  /** Demand request per sector, 0–1 (switch or potentiometer). */
  requests: sectorRecordSchema(z.number().min(0).max(1)),
});
export type TelemetryFrame = z.infer<typeof TelemetryFrameSchema>;

/** A frame placed on the simulated clock by the bridge (input of `scaleTelemetry`). */
export const TelemetrySampleSchema = z.object({
  simHour: z.number().int().min(0).max(23),
  lux: z.number().min(0).max(200_000),
  requests: z.record(SectorIdSchema, z.number().min(0).max(1)),
});
export type TelemetrySample = z.infer<typeof TelemetrySampleSchema>;

/** Setpoints sent to the model for one simulated hour. All values come from the engine result. */
export const HardwareCommandSchema = z.object({
  v: z.literal(1),
  seq: z.number().int().min(0),
  simHour: z.number().int().min(0).max(23),
  mode: ControllerModeSchema,
  socPct: z.number().min(0).max(100),
  batteryKw: z.number(),
  feeders: sectorRecordSchema(
    z.object({
      /** PWM duty 0–1 = servedKw / feeder nominal kW. */
      duty: z.number().min(0).max(1),
      breaker: BreakerStateSchema,
      /** 0–1 LED flow animation level (same curve as the 3D electrons). */
      flow: z.number().min(0).max(1),
      /** LED colour family; the firmware maps it to RGB tuned for its LEDs. */
      tone: FeederToneSchema,
    })
  ),
});
export type HardwareCommand = z.infer<typeof HardwareCommandSchema>;

/** `replay`: the engine drives the model. `twin`: the model's sensors feed the engine too. */
export const BridgeModeSchema = z.enum(['replay', 'twin']);
export type BridgeMode = z.infer<typeof BridgeModeSchema>;

/**
 * What the local bridge broadcasts to the web app each second. The web re-runs the engine on
 * `scenarios[scenarioId].input` + `patch` with `strategy`: no number is taken from the bridge as truth.
 */
export const BridgeStateSchema = z.object({
  v: z.literal(1),
  mode: BridgeModeSchema,
  scenarioId: ScenarioIdSchema,
  strategy: StrategyIdSchema,
  day: z.number().int().min(0),
  simHour: z.number().int().min(0).max(23),
  patch: InputPatchSchema,
  /** A valid telemetry frame arrived in the last 5 s. */
  deviceOnline: z.boolean(),
  scale: HardwareScaleSchema,
  command: HardwareCommandSchema,
});
export type BridgeState = z.infer<typeof BridgeStateSchema>;

/**
 * WebSocket message bridge → web: the state each second, and once per connection whether this
 * client may send commands (`control` false = read-only, the bridge token was missing or wrong).
 */
export const BridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state'), state: BridgeStateSchema }),
  z.object({ type: z.literal('access'), control: z.boolean() }),
]);
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;

/** WebSocket message web → bridge: cloud over the sun lamp, or a new speed (s per simulated hour). */
export const BridgeClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cloud'), on: z.boolean() }),
  z.object({ type: z.literal('speed'), timeScale: HardwareScaleSchema.shape.timeScale }),
]);
export type BridgeClientMessage = z.infer<typeof BridgeClientMessageSchema>;
