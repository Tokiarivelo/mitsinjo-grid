import { describe, expect, it } from 'vitest';
import { InputPatchSchema } from '@mitsinjo/engine';
import { observationToPatch } from '../observation-to-patch';

describe('observationToPatch (M4-T3, pure code)', () => {
  it('maps cloud cover to a bounded solarDropPct', () => {
    expect(
      observationToPatch([{ label: 'cloud_cover', value: 60, unit: '%', confidence: 0.8 }])
    ).toEqual({ patch: { solarDropPct: 60 }, unmapped: [] });
    // Bounds: the engine patch keeps 0–90.
    expect(
      observationToPatch([{ label: 'cloud_cover', value: 140, unit: '%', confidence: 0.5 }]).patch
    ).toEqual({ solarDropPct: 90 });
    expect(
      observationToPatch([{ label: 'cloud_cover', value: -5, unit: '%', confidence: 0.5 }]).patch
    ).toEqual({ solarDropPct: 0 });
  });

  it('maps a meter power reading to 24 hourly readings for the sector', () => {
    const { patch, unmapped } = observationToPatch(
      [{ label: 'meter_reading', value: 2.5, unit: 'kW', confidence: 0.9 }],
      { sector: 'school' }
    );
    expect(unmapped).toEqual([]);
    expect(patch.meterReadings?.school).toEqual(new Array(24).fill(2.5));
    expect(InputPatchSchema.safeParse(patch).success).toBe(true);
  });

  it('combines both conversions in one patch', () => {
    const { patch, unmapped } = observationToPatch(
      [
        { label: 'cloud_cover', value: 40, unit: '%', confidence: 0.7 },
        { label: 'meter_reading', value: 1, unit: 'kW', confidence: 0.9 },
      ],
      { sector: 'market' }
    );
    expect(patch).toEqual({
      solarDropPct: 40,
      meterReadings: { market: new Array(24).fill(1) },
    });
    expect(unmapped).toEqual([]);
    expect(InputPatchSchema.safeParse(patch).success).toBe(true);
  });

  it('maps panel shade and dust to an all-day solar loss (M8-T2)', () => {
    expect(
      observationToPatch([{ label: 'shaded_panel', value: 10, unit: '%', confidence: 0.8 }])
    ).toEqual({
      patch: { solarDropPct: 10, dropStartHour: 0, dropDurationH: 24 },
      unmapped: [],
    });
    expect(
      observationToPatch([{ label: 'dusty_panel', value: 25, unit: '%', confidence: 0.7 }])
    ).toEqual({
      patch: { solarDropPct: 25, dropStartHour: 0, dropDurationH: 24 },
      unmapped: [],
    });
    expect(
      observationToPatch([{ label: 'shaded_panel', value: 'half', confidence: 0.5 }]).unmapped
    ).toEqual([{ label: 'shaded_panel', reason: expect.stringContaining('number') }]);
  });

  it('cloud vs panel loss: max wins, ties go all-day (M8-T2)', () => {
    // Shade wins outright.
    expect(
      observationToPatch([
        { label: 'cloud_cover', value: 20, unit: '%', confidence: 0.7 },
        { label: 'shaded_panel', value: 30, unit: '%', confidence: 0.8 },
      ]).patch
    ).toEqual({ solarDropPct: 30, dropStartHour: 0, dropDurationH: 24 });
    // Cloud wins: its transient window (engine default) is kept.
    expect(
      observationToPatch([
        { label: 'cloud_cover', value: 70, unit: '%', confidence: 0.7 },
        { label: 'dusty_panel', value: 30, unit: '%', confidence: 0.8 },
      ]).patch
    ).toEqual({ solarDropPct: 70 });
    // Tie: the all-day envelope wins.
    expect(
      observationToPatch([
        { label: 'cloud_cover', value: 50, unit: '%', confidence: 0.7 },
        { label: 'shaded_panel', value: 50, unit: '%', confidence: 0.8 },
      ]).patch
    ).toEqual({ solarDropPct: 50, dropStartHour: 0, dropDurationH: 24 });
  });

  it('leaves the unmappable out with a reason, never throws', () => {
    const { patch, unmapped } = observationToPatch([
      { label: 'meter_reading', value: 1284, unit: 'kWh', confidence: 0.5 },
      { label: 'smoke', value: true, confidence: 0.5 },
      { label: 'mystery', value: 1, confidence: 0.5 },
    ]);
    expect(patch).toEqual({});
    expect(unmapped.map((u) => u.label)).toEqual(['meter_reading', 'smoke', 'mystery']);
    expect(unmapped.every((u) => u.reason.length > 0)).toBe(true);
    expect(
      observationToPatch([{ label: 'meter_reading', value: 2, unit: 'kW', confidence: 0.9 }])
        .unmapped
    ).toEqual([{ label: 'meter_reading', reason: expect.stringContaining('sector') }]);
  });
});
