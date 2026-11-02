import { describe, expect, it } from 'vitest';
import { scenarios, simulate } from '@mitsinjo/engine';
import { buildVisualPrompt } from '../generate-image';

describe('buildVisualPrompt (M5-T1)', () => {
  const cloudyInput = scenarios.cloudy_afternoon.input;
  const cloudy = simulate(cloudyInput, 'proportional');
  const baseInput = scenarios.baseline.input;
  const base = simulate(baseInput, 'proportional');

  it('village_tonight: evening scene from the engine result, no numbers in the prompt', () => {
    const v = buildVisualPrompt('village_tonight', baseInput, base, 'en');
    expect(v.prompt).not.toMatch(/\d/);
    expect(v.prompt).toMatch(/evening|night|dusk/);
    expect(v.overlay).toBeNull();
    expect(v.caption.length).toBeGreaterThan(0);
  });

  it('shedding_poster: overlay cuts match the engine unserved windows', () => {
    const v = buildVisualPrompt('shedding_poster', cloudyInput, cloudy, 'fr');
    expect(v.overlay).not.toBeNull();
    const cuts = v.overlay?.cuts ?? [];
    expect(cuts.length).toBeGreaterThan(0);
    for (const c of cuts) {
      expect(c.unservedKwh).toBeGreaterThan(0);
      expect(c.toHour).toBeGreaterThan(c.fromHour);
      // Every window hour really is short in the engine steps.
      for (let t = c.fromHour; t < c.toHour; t++) {
        const s = cloudy.steps[t]?.sectors[c.sector];
        expect(s!.demandKw - s!.servedKw).toBeGreaterThan(0);
      }
    }
    expect(v.prompt).not.toMatch(/\d/);
  });

  it('shedding_poster on a fully-served result: empty overlay, still no numbers', () => {
    const v = buildVisualPrompt('shedding_poster', baseInput, base, 'en');
    expect(v.overlay?.cuts).toEqual([]);
    expect(v.prompt).not.toMatch(/\d/);
  });

  it('day_comic: four panels from the engine day, states as words, hours in the overlay (M12-T3)', () => {
    const v = buildVisualPrompt('day_comic', cloudyInput, cloudy, 'en');
    expect(v.prompt).not.toMatch(/\d/);
    expect(v.prompt).toMatch(/comic strip/);
    const panels = v.overlay?.panels ?? [];
    expect(panels.map((p) => p.hour)).toEqual([7, 12, 17, 21]);
    for (const p of panels) {
      // The cuts flag matches a real shortfall at that hour in the engine steps.
      const step = cloudy.steps[p.hour]!;
      const short = Object.values(step.sectors).some(
        (s) => s.demandKw > 0.05 && s.demandKw - s.servedKw > 1e-9
      );
      expect(p.cuts).toBe(short);
      expect(['night', 'sunny', 'partly_cloudy', 'overcast']).toContain(p.sky);
    }
    expect(v.caption.length).toBeGreaterThan(0);
  });

  it('day_comic caption is translated (M12-T3)', () => {
    const en = buildVisualPrompt('day_comic', baseInput, base, 'en');
    const fr = buildVisualPrompt('day_comic', baseInput, base, 'fr');
    const mg = buildVisualPrompt('day_comic', baseInput, base, 'mg');
    expect(new Set([en.caption, fr.caption, mg.caption]).size).toBe(3);
  });
});
