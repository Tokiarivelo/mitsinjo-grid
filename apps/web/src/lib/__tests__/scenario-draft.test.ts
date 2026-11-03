import { describe, it, expect } from 'vitest';
import {
  type ScenarioDraft,
  missingSlots,
  applyDraftDefaults,
  draftToWorkflow,
  ScenarioDraftSchema,
} from '../scenario-draft';

describe('ScenarioDraft (PA-T8b)', () => {
  it('identifies exactly 1 missing slot (fire hour) for the target example', () => {
    // Target example: « jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu »
    const draft: ScenarioDraft = {
      days: [
        { day: 1, weather: 'cloudy' },
        { day: 2, weather: 'rainy' },
        {
          day: 3,
          weather: 'sunny',
          events: [
            {
              type: 'fire',
              sector: 'school',
              // startHour intentionally omitted!
            },
          ],
        },
      ],
    };

    expect(ScenarioDraftSchema.safeParse(draft).success).toBe(true);

    const slots = missingSlots(draft);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      kind: 'missing_fire_hour',
      day: 3,
      eventIndex: 0,
    });
    expect(slots[0]?.suggestedResponses.length).toBeGreaterThanOrEqual(3);
  });

  it('reports 0 missing slots when the target example draft is completed with startHour', () => {
    const draft: ScenarioDraft = {
      days: [
        { day: 1, weather: 'cloudy' },
        { day: 2, weather: 'rainy' },
        {
          day: 3,
          weather: 'sunny',
          events: [
            {
              type: 'fire',
              sector: 'school',
              startHour: 10,
            },
          ],
        },
      ],
    };

    const slots = missingSlots(draft);
    expect(slots).toHaveLength(0);
  });

  it('flags missing weather, missing sectors and missing spike factors', () => {
    const draft: ScenarioDraft = {
      days: [
        {
          day: 1,
          // weather missing!
        },
        {
          day: 2,
          weather: 'sunny',
          events: [
            {
              type: 'fire',
              // sector and startHour missing!
            },
            {
              type: 'demand_spike',
              // sector and factor missing!
            },
          ],
        },
      ],
    };

    const slots = missingSlots(draft);
    const kinds = slots.map((s) => s.kind);
    expect(kinds).toContain('missing_weather');
    expect(kinds).toContain('missing_fire_sector');
    expect(kinds).toContain('missing_fire_hour');
    expect(kinds).toContain('missing_spike_sector');
    expect(kinds).toContain('missing_spike_factor');
  });

  it('detects days out of bounds (> 7) and duplicate days', () => {
    const draft: ScenarioDraft = {
      days: [
        { day: 1, weather: 'sunny' },
        { day: 1, weather: 'cloudy' }, // duplicate
        { day: 8, weather: 'rainy' }, // out of bounds
      ],
    };

    const slots = missingSlots(draft);
    const kinds = slots.map((s) => s.kind);
    expect(kinds).toContain('duplicate_weather');
    expect(kinds).toContain('day_out_of_bounds');
  });

  it('applyDraftDefaults sets fire until midnight, SoC 60%, and proportional strategy', () => {
    const draft: ScenarioDraft = {
      days: [
        { day: 1, weather: 'cloudy' },
        {
          day: 2,
          weather: 'sunny',
          events: [
            {
              type: 'fire',
              sector: 'market',
              startHour: 14,
              // durationH omitted
            },
          ],
        },
      ],
    };

    const filled = applyDraftDefaults(draft);
    expect(filled.startSocPct).toBe(60);
    expect(filled.strategy).toBe('proportional');
    expect(filled.dispatchMode).toBe('manual');

    const fireEvent = filled.days[1]?.events?.[0];
    expect(fireEvent?.type).toBe('fire');
    if (fireEvent?.type === 'fire') {
      expect(fireEvent.durationH).toBe(10); // 24 - 14 = 10 h until midnight!
    }
  });

  it('draftToWorkflow produces valid engine WorkflowDays with per-day events', () => {
    const draft: ScenarioDraft = {
      days: [
        { day: 1, weather: 'sunny' },
        { day: 2, weather: 'rainy' },
        {
          day: 3,
          weather: 'storm',
          events: [
            {
              type: 'fire',
              sector: 'school',
              startHour: 12,
              durationH: 12,
            },
          ],
        },
      ],
    };

    const { workflow, startSocPct, strategy, dispatchMode } = draftToWorkflow(draft);
    expect(workflow).toHaveLength(3);
    expect(workflow[0]?.weather).toBe('sunny');
    expect(workflow[0]?.events).toBeUndefined();
    expect(workflow[1]?.weather).toBe('rainy');
    expect(workflow[2]?.weather).toBe('storm');
    expect(workflow[2]?.events).toHaveLength(1);
    expect(workflow[2]?.events?.[0]).toEqual({
      type: 'fire',
      sector: 'school',
      startHour: 12,
      durationH: 12,
    });
    expect(startSocPct).toBe(60);
    expect(strategy).toBe('proportional');
    expect(dispatchMode).toBe('manual');
  });
});
