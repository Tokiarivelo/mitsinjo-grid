import { describe, expect, it } from 'vitest';
import { activeFires, type Workflow } from '@mitsinjo/engine';
import { clearWorkflowFires, dayEvents, reportWorkflowFire } from '../day-events';

const week: Workflow = [{ weather: 'sunny' }, { weather: 'cloudy' }, { weather: 'rainy' }];
const burning = (wf: Workflow, day: number, hour: number) =>
  activeFires(dayEvents([], wf, day), hour).map((f) => f.sector);

describe('fires on a multi-day run', () => {
  it('burns from the report hour, then all day on the next days (no gap at night)', () => {
    const wf = reportWorkflowFire(week, 1, 'market', 14);
    expect(burning(wf, 0, 20)).toEqual([]);
    expect(burning(wf, 1, 13)).toEqual([]);
    expect(burning(wf, 1, 14)).toEqual(['market']);
    expect(burning(wf, 1, 23)).toEqual(['market']);
    // Regression: the fire used to vanish from 0 h to 14 h on the next day.
    for (let h = 0; h < 24; h++) expect(burning(wf, 2, h)).toEqual(['market']);
  });

  it('a restore puts the fire out on every day and keeps other events', () => {
    const withDrop: Workflow = week.map((d) => ({
      ...d,
      events: [{ type: 'solar_drop', startHour: 10, durationH: 2, factor: 0.5 }],
    }));
    const wf = clearWorkflowFires(reportWorkflowFire(withDrop, 0, 'school', 9), ['school']);
    for (let d = 0; d < 3; d++) {
      expect(burning(wf, d, 12)).toEqual([]);
      expect(wf[d]!.events).toHaveLength(1);
    }
    expect(clearWorkflowFires(week, ['school'])).toEqual(week);
  });

  it('day events add the input events (every day) to the day ones', () => {
    const fire = { type: 'fire' as const, sector: 'water' as const, startHour: 0, durationH: 24 };
    expect(dayEvents([fire], week, 2)).toEqual([fire]);
    expect(dayEvents(undefined, reportWorkflowFire(week, 0, 'health', 3), 0)).toHaveLength(1);
  });
});
