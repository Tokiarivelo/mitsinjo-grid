import {
  applyPatch,
  BridgeStateSchema,
  DEFAULT_HARDWARE_SCALE,
  HardwareCommandSchema,
  scenarios,
  SECTOR_IDS,
  simulate,
  toHardwareCommand,
} from '@mitsinjo/engine';
import type { TelemetryFrame } from '@mitsinjo/engine';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { loadConfig } from '../config';
import { mergeEnv } from '../env-files';
import { BridgeSession, DEVICE_TIMEOUT_MS, simClock } from '../session';

const HOUR_MS = DEFAULT_HARDWARE_SCALE.timeScale * 1000;
const at = (hour: number, day = 0) => (day * 24 + hour) * HOUR_MS + 10;

function frame(lux: number, requests: Partial<TelemetryFrame['requests']> = {}): TelemetryFrame {
  const ch = { mV: 12_000, mA: 10 };
  return {
    v: 1,
    deviceId: 'sim',
    seq: 0,
    uptimeMs: 0,
    lux,
    pv: ch,
    battery: ch,
    feeders: Object.fromEntries(SECTOR_IDS.map((id) => [id, ch])) as TelemetryFrame['feeders'],
    requests: {
      ...(Object.fromEntries(SECTOR_IDS.map((id) => [id, 1])) as TelemetryFrame['requests']),
      ...requests,
    },
  };
}

const session = (mode: 'replay' | 'twin') =>
  new BridgeSession({
    mode,
    scenarioId: 'baseline',
    strategy: 'essential_first',
    scale: DEFAULT_HARDWARE_SCALE,
  });

describe('simClock', () => {
  it('maps real time to simulated day and hour', () => {
    expect(simClock(0, 60)).toEqual({ day: 0, hour: 0 });
    expect(simClock(59_999, 60)).toEqual({ day: 0, hour: 0 });
    expect(simClock(60_000 * 13, 60)).toEqual({ day: 0, hour: 13 });
    expect(simClock(60_000 * 25, 60)).toEqual({ day: 1, hour: 1 });
    expect(simClock(-5, 60)).toEqual({ day: 0, hour: 0 });
  });

  it('continues from a starting hour', () => {
    expect(simClock(0, 5, 23.5)).toEqual({ day: 0, hour: 23 });
    expect(simClock(5_000, 5, 23.5)).toEqual({ day: 1, hour: 0 });
  });
});

describe('BridgeSession — speed', () => {
  it('changes pace without jumping the current hour', () => {
    const s = session('replay');
    const t = at(10) + HOUR_MS / 2; // 10:30 at the default speed
    expect(s.tick(t).simHour).toBe(10);
    expect(s.setTimeScale(5, t)).toBe(true);
    const now = s.tick(t);
    expect(now.simHour).toBe(10);
    expect(now.scale.timeScale).toBe(5);
    // Half an hour left at 5 s per hour → 11:00 after 2.5 s, 12:00 after 7.5 s.
    expect(s.tick(t + 2_400).simHour).toBe(10);
    expect(s.tick(t + 2_600).simHour).toBe(11);
    expect(s.tick(t + 7_600).simHour).toBe(12);
  });

  it('rejects an out-of-range speed and keeps the current one', () => {
    const s = session('replay');
    expect(s.setTimeScale(0, 1000)).toBe(false);
    expect(s.tick(1000).scale.timeScale).toBe(DEFAULT_HARDWARE_SCALE.timeScale);
  });
});

describe('BridgeSession — replay', () => {
  it('sends the engine setpoints of the scenario, hour by hour', () => {
    const s = session('replay');
    const input = scenarios.baseline.input;
    const result = simulate(input, 'essential_first');
    for (const h of [0, 12, 19]) {
      const state = s.tick(at(h));
      expect(state.simHour).toBe(h);
      expect(state.patch).toEqual({});
      expect(() => HardwareCommandSchema.parse(state.command)).not.toThrow();
      expect(() => BridgeStateSchema.parse(state)).not.toThrow();
      expect(state.command.feeders).toEqual(
        toHardwareCommand(input, result, h, DEFAULT_HARDWARE_SCALE).feeders
      );
    }
  });

  it('ignores sensors and numbers commands in order', () => {
    const s = session('replay');
    s.ingest(frame(0), at(12));
    const a = s.tick(at(12));
    const b = s.tick(at(12));
    expect(a.patch).toEqual({});
    expect(b.command.seq).toBe(a.command.seq + 1);
  });
});

describe('BridgeSession — twin', () => {
  it('a cloud on the lamp lowers the measured solar hour and the engine follows', () => {
    const s = session('twin');
    s.ingest(frame(DEFAULT_HARDWARE_SCALE.luxFullSun * 0.2), at(12));
    const state = s.tick(at(12));
    const base = scenarios.baseline.input;
    expect(state.patch.solarProfile![12]).toBeCloseTo(base.solar.profile[12]! * 0.2);
    const expected = simulate(applyPatch(base, state.patch), 'essential_first');
    expect(state.command.socPct).toBe(expected.steps[12]!.socPct);
  });

  it('rejects invalid frames', () => {
    const s = session('twin');
    expect(s.ingest({ v: 2 }, at(1))).toBeNull();
    expect(s.ingest({ ...frame(10), requests: { health: 3 } }, at(1))).toBeNull();
    expect(s.tick(at(1)).patch).toEqual({});
  });

  it('drops the previous day measurements at midnight', () => {
    const s = session('twin');
    s.ingest(frame(0), at(12));
    expect(Object.keys(s.tick(at(12)).patch)).not.toHaveLength(0);
    expect(s.tick(at(0, 1)).patch).toEqual({});
  });

  it('reports the device offline after the timeout', () => {
    const s = session('twin');
    expect(s.tick(at(3)).deviceOnline).toBe(false);
    s.ingest(frame(10), at(3));
    expect(s.tick(at(3) + 1000).deviceOnline).toBe(true);
    expect(s.tick(at(3) + DEVICE_TIMEOUT_MS + 1).deviceOnline).toBe(false);
  });
});

describe('loadConfig', () => {
  it('uses safe defaults', () => {
    const c = loadConfig({});
    expect(c).toMatchObject({
      mode: 'replay',
      scenarioId: 'cloudy_afternoon',
      strategy: 'essential_first',
      wsPort: 8787,
      embeddedBroker: true,
      mqttUrl: 'mqtt://localhost:1883',
    });
    expect(c.scale).toEqual(DEFAULT_HARDWARE_SCALE);
  });

  it('treats empty values as unset (.env.example placeholders)', () => {
    const c = loadConfig({ MQTT_URL: '', HW_POWER_SCALE: '', BRIDGE_MODE: '' });
    expect(c.mqttUrl).toBe('mqtt://localhost:1883');
    expect(c.scale.powerScale).toBe(DEFAULT_HARDWARE_SCALE.powerScale);
    expect(c.mode).toBe('replay');
  });

  it('reads overrides and rejects unknown values', () => {
    const c = loadConfig({
      BRIDGE_MODE: 'twin',
      HW_TIME_SCALE: '30',
      BRIDGE_EMBEDDED_BROKER: 'false',
    });
    expect(c.mode).toBe('twin');
    expect(c.scale.timeScale).toBe(30);
    expect(c.embeddedBroker).toBe(false);
    expect(() => loadConfig({ BRIDGE_SCENARIO: 'nope' })).toThrow(ZodError);
  });
});

describe('mergeEnv', () => {
  it('shell beats .env.local, which beats .env; unset shell values do not hide files', () => {
    const merged = mergeEnv({ HW_TIME_SCALE: '4', BRIDGE_MODE: undefined }, [
      { BRIDGE_MODE: 'twin', MQTT_PORT: '1884' },
      { HW_TIME_SCALE: '60', BRIDGE_MODE: 'replay', MQTT_PORT: '1883', BRIDGE_WS_PORT: '9000' },
    ]);
    expect(merged).toEqual({
      HW_TIME_SCALE: '4',
      BRIDGE_MODE: 'twin',
      MQTT_PORT: '1884',
      BRIDGE_WS_PORT: '9000',
    });
    expect(loadConfig(merged).scale.timeScale).toBe(4);
  });
});
