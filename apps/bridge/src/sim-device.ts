/**
 * Fake ESP32 for development and demos without hardware (`make bridge-sim`).
 * Publishes TelemetryFrame at 1 Hz like the firmware and prints the setpoints it receives.
 * Keys: `c` toggles a cloud over the sun lamp, `q` quits.
 */
import { HardwareCommandSchema, SECTOR_IDS } from '@mitsinjo/engine';
import type { HardwareCommand, TelemetryFrame } from '@mitsinjo/engine';
import mqtt from 'mqtt';
import { loadConfig, TOPICS } from './config';
import { readEnv } from './env-files';

/** Light left on the reference sensor under the cardboard cloud. */
const CLOUD_LUX_RATIO = 0.3;
const BUS_MV = 12_800;

const config = loadConfig(readEnv());
const client = mqtt.connect(config.mqttUrl, {
  clientId: `mitsinjo-sim-${process.pid}`,
  ...config.mqttAuth,
});
let cloud = false;
let seq = 0;
let lastCommand: HardwareCommand | null = null;
const start = Date.now();

/** Fake feeder current: duty × nominal W at bus voltage (what an INA3221 would read). */
function feederMa(id: (typeof SECTOR_IDS)[number]): number {
  const duty = lastCommand?.feeders[id].duty ?? 0;
  return ((duty * config.scale.nominalW[id]) / (BUS_MV / 1000)) * 1000;
}

function frame(): TelemetryFrame {
  return {
    v: 1,
    deviceId: 'sim-device',
    seq: seq++,
    uptimeMs: Date.now() - start,
    lux: config.scale.luxFullSun * (cloud ? CLOUD_LUX_RATIO : 1),
    pv: { mV: 18_000, mA: 0 },
    battery: { mV: BUS_MV, mA: 0 },
    feeders: Object.fromEntries(
      SECTOR_IDS.map((id) => [id, { mV: BUS_MV, mA: feederMa(id) }])
    ) as TelemetryFrame['feeders'],
    requests: Object.fromEntries(SECTOR_IDS.map((id) => [id, 1])) as TelemetryFrame['requests'],
  };
}

function describe(cmd: HardwareCommand): string {
  const feeders = SECTOR_IDS.map(
    (id) => `${id} ${Math.round(cmd.feeders[id].duty * 100)}% ${cmd.feeders[id].breaker}`
  ).join(' · ');
  return `${String(cmd.simHour).padStart(2, '0')}:00 ${cmd.mode} SoC ${cmd.socPct.toFixed(0)}% | ${feeders}`;
}

client.on('connect', () => {
  client.subscribe([TOPICS.command, TOPICS.cloud]);
  console.log(`[sim] connected to ${config.mqttUrl} — press c = cloud, q = quit`);
});
client.on('error', (err) => console.error(`[sim] MQTT error: ${err.message}`));
client.on('message', (topic, payload) => {
  try {
    const data: unknown = JSON.parse(payload.toString());
    if (topic === TOPICS.cloud) {
      cloud = Boolean((data as { on?: boolean }).on);
      console.log(`[sim] cloud ${cloud ? 'on' : 'off'} (from app)`);
      return;
    }
    const cmd = HardwareCommandSchema.parse(data);
    if (cmd.simHour !== lastCommand?.simHour) console.log(`[sim] ${describe(cmd)}`);
    lastCommand = cmd;
  } catch {
    console.warn('[sim] invalid message ignored');
  }
});

setInterval(() => client.publish(TOPICS.telemetry, JSON.stringify(frame())), 1000);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (key) => {
    const k = key.toString();
    if (k === 'c') {
      cloud = !cloud;
      console.log(`[sim] cloud ${cloud ? 'on' : 'off'}`);
    } else if (k === 'q' || k === '\u0003') {
      client.end();
      process.exit(0);
    }
  });
}
