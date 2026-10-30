import {
  BridgeModeSchema,
  DEFAULT_HARDWARE_SCALE,
  ScenarioIdSchema,
  StrategyIdSchema,
} from '@mitsinjo/engine';
import type { BridgeMode, HardwareScale } from '@mitsinjo/engine';
import { z } from 'zod';

const EnvSchema = z.object({
  BRIDGE_MODE: BridgeModeSchema.default('replay'),
  BRIDGE_SCENARIO: ScenarioIdSchema.default('cloudy_afternoon'),
  BRIDGE_STRATEGY: StrategyIdSchema.default('essential_first'),
  BRIDGE_WS_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  /** Start an in-process MQTT broker (no Mosquitto needed). */
  BRIDGE_EMBEDDED_BROKER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  MQTT_PORT: z.coerce.number().int().min(1).max(65535).default(1883),
  MQTT_URL: z.string().url().optional(),
  /** Required on the WebSocket (`?token=`) to send commands; unset = open (local use only). */
  BRIDGE_TOKEN: z.string().min(16).optional(),
  /** MQTT login: checked by the embedded broker, sent by the bridge and the fake device. */
  MQTT_USERNAME: z.string().min(1).optional(),
  MQTT_PASSWORD: z.string().min(1).optional(),
  HW_POWER_SCALE: z.coerce.number().optional(),
  HW_TIME_SCALE: z.coerce.number().optional(),
  HW_LUX_FULL_SUN: z.coerce.number().optional(),
});

export interface BridgeConfig {
  mode: BridgeMode;
  scenarioId: z.infer<typeof ScenarioIdSchema>;
  strategy: z.infer<typeof StrategyIdSchema>;
  wsPort: number;
  embeddedBroker: boolean;
  mqttPort: number;
  mqttUrl: string;
  token?: string;
  mqttAuth: { username?: string; password?: string };
  scale: HardwareScale;
}

/** Reads the bridge settings from env (see .env.example § Scale model bridge). Throws ZodError. */
export function loadConfig(env: Record<string, string | undefined>): BridgeConfig {
  // Empty values (e.g. `MQTT_URL=` copied from .env.example) mean "use the default".
  const set = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== '')
  );
  const e = EnvSchema.refine((v) => !v.MQTT_USERNAME === !v.MQTT_PASSWORD, {
    message: 'MQTT_USERNAME and MQTT_PASSWORD go together',
    path: ['MQTT_PASSWORD'],
  }).parse(set);
  return {
    mode: e.BRIDGE_MODE,
    scenarioId: e.BRIDGE_SCENARIO,
    strategy: e.BRIDGE_STRATEGY,
    wsPort: e.BRIDGE_WS_PORT,
    embeddedBroker: e.BRIDGE_EMBEDDED_BROKER,
    mqttPort: e.MQTT_PORT,
    mqttUrl: e.MQTT_URL ?? `mqtt://localhost:${e.MQTT_PORT}`,
    token: e.BRIDGE_TOKEN,
    mqttAuth: { username: e.MQTT_USERNAME, password: e.MQTT_PASSWORD },
    scale: {
      ...DEFAULT_HARDWARE_SCALE,
      powerScale: e.HW_POWER_SCALE ?? DEFAULT_HARDWARE_SCALE.powerScale,
      timeScale: e.HW_TIME_SCALE ?? DEFAULT_HARDWARE_SCALE.timeScale,
      luxFullSun: e.HW_LUX_FULL_SUN ?? DEFAULT_HARDWARE_SCALE.luxFullSun,
    },
  };
}

/** MQTT topics shared by the bridge, the firmware and the fake device. */
export const TOPICS = {
  telemetry: 'mitsinjo/v1/telemetry',
  command: 'mitsinjo/v1/command',
  cloud: 'mitsinjo/v1/cloud',
} as const;
