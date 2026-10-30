import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  ACTIVE_FEEDER_KW,
  breakerFromMode,
  feederTone,
  controllerModeAt,
  flowLevel,
  FLOW_SATURATION_KW,
} from '../dispatch';
import {
  DEFAULT_HARDWARE_SCALE,
  feederNominalKw,
  scaleTelemetry,
  TIME_SCALE_PRESETS,
  toHardwareCommand,
} from '../hardware';
import { computeProfileDemandKw } from '../model';
import { applyPatch } from '../patch';
import { createBaselineInput, createCloudyAfternoonInput } from '../scenarios';
import {
  BridgeClientMessageSchema,
  BridgeMessageSchema,
  HardwareCommandSchema,
  HardwareScaleSchema,
  SECTOR_IDS,
  TelemetryFrameSchema,
} from '../schemas';
import type { TelemetrySample } from '../schemas';
import { simulate } from '../simulate';

const ALL_ON = Object.fromEntries(SECTOR_IDS.map((id) => [id, 1]));
const full = (simHour: number, lux = DEFAULT_HARDWARE_SCALE.luxFullSun): TelemetrySample => ({
  simHour,
  lux,
  requests: ALL_ON,
});

describe('dispatch helpers (PH-H1)', () => {
  it('maps sector modes to breakers', () => {
    expect(breakerFromMode('full')).toBe('closed');
    expect(breakerFromMode('limited')).toBe('closed');
    expect(breakerFromMode('lifeline')).toBe('limited');
    expect(breakerFromMode('off')).toBe('open');
  });

  it('flowLevel saturates and rejects non-finite values', () => {
    expect(flowLevel(0)).toBe(0);
    expect(flowLevel(FLOW_SATURATION_KW / 2)).toBeCloseTo(0.5);
    expect(flowLevel(FLOW_SATURATION_KW * 10)).toBe(1);
    expect(flowLevel(-1)).toBe(0);
    expect(flowLevel(Number.NaN)).toBe(0);
  });

  it('controller is normal when every loaded feeder is fully served', () => {
    const input = createBaselineInput();
    const result = simulate(input, 'proportional');
    expect(controllerModeAt(input, result, 12)).toBe('normal');
  });

  it('controller leaves normal during the cloudy-afternoon evening deficit', () => {
    const input = createCloudyAfternoonInput();
    const result = simulate(input, 'proportional');
    const hours = result.steps.filter((s) => s.unservedKw > ACTIVE_FEEDER_KW).map((s) => s.t);
    expect(hours.length).toBeGreaterThan(0);
    for (const h of hours) expect(controllerModeAt(input, result, h)).not.toBe('normal');
  });
});

describe('feederTone (PH-H2)', () => {
  const base = { connected: true, demandKw: 2, servedKw: 2, breaker: 'closed' as const };
  it.each([
    ['disconnected', { ...base, connected: false }, 'idle'],
    ['closed, no demand', { ...base, demandKw: 0, servedKw: 0 }, 'idle'],
    ['closed, fully served', base, 'ok'],
    ['closed, partly served', { ...base, servedKw: 1 }, 'warning'],
    ['closed, nothing served', { ...base, servedKw: 0 }, 'critical'],
    ['limited (lifeline)', { ...base, servedKw: 0.4, breaker: 'limited' as const }, 'warning'],
    ['open with demand', { ...base, servedKw: 0, breaker: 'open' as const }, 'critical'],
    ['open, no demand', { ...base, demandKw: 0, servedKw: 0, breaker: 'open' as const }, 'idle'],
  ])('%s → %s', (_label, args, tone) => {
    expect(feederTone(args)).toBe(tone);
  });
});

describe('HardwareScale / TelemetryFrame schemas (PH-H1)', () => {
  it('accepts the default scale and rejects out-of-range values', () => {
    expect(() => HardwareScaleSchema.parse(DEFAULT_HARDWARE_SCALE)).not.toThrow();
    expect(() => HardwareScaleSchema.parse({ ...DEFAULT_HARDWARE_SCALE, luxFullSun: 0 })).toThrow(
      ZodError
    );
    const { health: _h, ...missing } = DEFAULT_HARDWARE_SCALE.nominalW;
    expect(() =>
      HardwareScaleSchema.parse({ ...DEFAULT_HARDWARE_SCALE, nominalW: missing })
    ).toThrow(ZodError);
  });

  it('offers valid speeds, slow to fast, including the default', () => {
    for (const timeScale of TIME_SCALE_PRESETS) {
      expect(() =>
        HardwareScaleSchema.parse({ ...DEFAULT_HARDWARE_SCALE, timeScale })
      ).not.toThrow();
    }
    expect([...TIME_SCALE_PRESETS].sort((a, b) => b - a)).toEqual([...TIME_SCALE_PRESETS]);
    expect(TIME_SCALE_PRESETS).toContain(DEFAULT_HARDWARE_SCALE.timeScale);
  });

  it('parses the bridge → web access message', () => {
    expect(BridgeMessageSchema.parse({ type: 'access', control: false })).toEqual({
      type: 'access',
      control: false,
    });
    expect(BridgeMessageSchema.safeParse({ type: 'access' }).success).toBe(false);
  });

  it('parses web → bridge messages and rejects an out-of-range speed', () => {
    expect(BridgeClientMessageSchema.parse({ type: 'speed', timeScale: 5 })).toEqual({
      type: 'speed',
      timeScale: 5,
    });
    expect(BridgeClientMessageSchema.safeParse({ type: 'cloud', on: true }).success).toBe(true);
    expect(BridgeClientMessageSchema.safeParse({ type: 'speed', timeScale: 0 }).success).toBe(
      false
    );
    expect(BridgeClientMessageSchema.safeParse({ type: 'reboot' }).success).toBe(false);
  });

  it('rejects a frame with a request above 1', () => {
    const channel = { mV: 12000, mA: 10 };
    const frame = {
      v: 1,
      deviceId: 'esp32-a',
      seq: 1,
      uptimeMs: 1000,
      lux: 500,
      pv: channel,
      battery: channel,
      feeders: Object.fromEntries(SECTOR_IDS.map((id) => [id, channel])),
      requests: ALL_ON,
    };
    expect(() => TelemetryFrameSchema.parse(frame)).not.toThrow();
    expect(() =>
      TelemetryFrameSchema.parse({ ...frame, requests: { ...ALL_ON, water: 1.5 } })
    ).toThrow(ZodError);
  });

  it('default nominal power matches the sector peaks at 1 W = 4 kW', () => {
    expect(feederNominalKw(DEFAULT_HARDWARE_SCALE, 'households')).toBeCloseTo(6);
    expect(feederNominalKw(DEFAULT_HARDWARE_SCALE, 'health')).toBeCloseTo(1.2);
  });
});

describe('scaleTelemetry (PH-H1)', () => {
  it('returns an empty patch without samples', () => {
    expect(scaleTelemetry([], DEFAULT_HARDWARE_SCALE, createBaselineInput())).toEqual({});
  });

  it('full lamp and all switches on reproduce the base input results', () => {
    const base = createBaselineInput();
    const patch = scaleTelemetry([full(10), full(11)], DEFAULT_HARDWARE_SCALE, base);
    expect(patch.solarProfile).toEqual(base.solar.profile);
    const patched = applyPatch(base, patch);
    const a = simulate(base, 'essential_first');
    const b = simulate(patched, 'essential_first');
    expect(b.metrics.servedKwh).toBeCloseTo(a.metrics.servedKwh, 9);
    expect(b.metrics.unservedKwh).toBeCloseTo(a.metrics.unservedKwh, 9);
  });

  it('a cloud on the lamp lowers only the measured hours', () => {
    const base = createBaselineInput();
    const lux = DEFAULT_HARDWARE_SCALE.luxFullSun;
    const patch = scaleTelemetry(
      [full(13, lux * 0.4), full(13, lux * 0.2), full(14, lux * 5)],
      DEFAULT_HARDWARE_SCALE,
      base
    );
    const profile = patch.solarProfile!;
    expect(profile[13]).toBeCloseTo(base.solar.profile[13]! * 0.3);
    expect(profile[14]).toBeCloseTo(base.solar.profile[14]!); // clamped to clear sky
    expect(profile[12]).toBe(base.solar.profile[12]);
    expect(applyPatch(base, patch).solar.profile[13]).toBeCloseTo(profile[13]!);
  });

  it('a switched-off sector demands 0 kW at measured hours only', () => {
    const base = createBaselineInput();
    const off = { ...full(10), requests: { ...ALL_ON, market: 0 } };
    const half = { ...full(11), requests: { ...ALL_ON, market: 0.5 } };
    const readings = scaleTelemetry([off, half], DEFAULT_HARDWARE_SCALE, base).meterReadings!
      .market!;
    const market = base.sectors.find((s) => s.id === 'market')!;
    const expected = (h: number) =>
      computeProfileDemandKw(market, base.demandMultiplier, base.events, h);
    expect(readings[10]).toBe(0);
    expect(readings[11]).toBeCloseTo(expected(11) * 0.5);
    expect(readings[12]).toBeCloseTo(expected(12));
    expect(
      simulate(applyPatch(base, { meterReadings: { market: readings } }), 'proportional').steps[10]!
        .sectors.market!.demandKw
    ).toBe(0);
  });

  it('does not mutate the base input', () => {
    const base = createBaselineInput();
    const snapshot = structuredClone(base);
    scaleTelemetry([full(9, 0)], DEFAULT_HARDWARE_SCALE, base);
    expect(base).toEqual(snapshot);
  });
});

describe('toHardwareCommand (PH-H1)', () => {
  const input = createCloudyAfternoonInput();
  const result = simulate(input, 'essential_first');

  it('produces a valid command for every hour', () => {
    for (let h = 0; h < 24; h++) {
      const cmd = toHardwareCommand(input, result, h, DEFAULT_HARDWARE_SCALE, h);
      expect(() => HardwareCommandSchema.parse(cmd)).not.toThrow();
      expect(cmd.socPct).toBe(result.steps[h]!.socPct);
      expect(cmd.mode).toBe(controllerModeAt(input, result, h));
    }
  });

  it('duty = served / nominal kW and breaker follows the engine mode', () => {
    for (let h = 0; h < 24; h++) {
      const cmd = toHardwareCommand(input, result, h, DEFAULT_HARDWARE_SCALE);
      for (const id of SECTOR_IDS) {
        const sec = result.steps[h]!.sectors[id]!;
        const nominal = feederNominalKw(DEFAULT_HARDWARE_SCALE, id);
        expect(cmd.feeders[id].duty).toBeCloseTo(Math.min(1, sec.servedKw / nominal));
        expect(cmd.feeders[id].flow).toBe(flowLevel(sec.servedKw));
      }
    }
  });

  it('a disconnected sector (industry) is open with zero duty', () => {
    const cmd = toHardwareCommand(input, result, 12, DEFAULT_HARDWARE_SCALE);
    expect(cmd.feeders.industry).toEqual({ duty: 0, breaker: 'open', flow: 0, tone: 'idle' });
  });

  it('clamps the hour into 0–23', () => {
    expect(toHardwareCommand(input, result, 99, DEFAULT_HARDWARE_SCALE).simHour).toBe(23);
    expect(toHardwareCommand(input, result, -3, DEFAULT_HARDWARE_SCALE).simHour).toBe(0);
  });
});
