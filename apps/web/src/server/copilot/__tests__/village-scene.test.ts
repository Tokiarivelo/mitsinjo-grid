import { describe, expect, it } from 'vitest';
import { applyPatch, scenarios, simulate, type SimulationInput } from '@mitsinjo/engine';
import { describeVillageScene, villageSceneCaption } from '../village-scene';

const base = scenarios.baseline.input;
const sceneAt = (input: SimulationInput, hour: number) =>
  describeVillageScene(input, simulate(input, 'proportional'), hour);

describe('describeVillageScene (engine state → image prompt words)', () => {
  it('never puts a number in the prompt, for every scenario and hour', () => {
    for (const def of Object.values(scenarios)) {
      const result = simulate(def.input, 'proportional');
      for (let h = 0; h < 24; h++) {
        expect(describeVillageScene(def.input, result, h).prompt).not.toMatch(/\d/);
      }
    }
  });

  it('shows night at 2 h and daylight at noon', () => {
    expect(sceneAt(base, 2).sky).toBe('night');
    expect(sceneAt(base, 2).prompt).toContain('starry sky');
    expect(sceneAt(base, 12).sky).not.toBe('night');
  });

  it('turns a strong solar drop into heavy clouds', () => {
    const dropped = applyPatch(base, { solarDropPct: 90, dropStartHour: 11, dropDurationH: 3 });
    expect(sceneAt(base, 12).sky).toBe('sunny');
    expect(sceneAt(dropped, 12).sky).toBe('overcast');
  });

  it('shows a sector capped to zero as cut, never as powered', () => {
    const cut = applyPatch(base, {
      sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 8, toHour: 23 }],
    });
    const scene = sceneAt(cut, 12);
    expect(['dark', 'closed']).toContain(scene.sectors.market);
    expect(scene.prompt).toMatch(/market stalls (without power|closed)/);
  });

  it('leaves out a sector that is not connected', () => {
    const disconnected = applyPatch(base, { sectorLoads: { market: 0 } });
    expect(sceneAt(disconnected, 12).sectors.market).toBeUndefined();
    expect(sceneAt(disconnected, 12).prompt).not.toContain('market');
  });

  it('clamps the hour into the day', () => {
    expect(sceneAt(base, 30).hour).toBe(23);
    expect(sceneAt(base, -4).hour).toBe(0);
  });

  it('captions the hour and each sector state in the user language', () => {
    const scene = sceneAt(base, 12);
    expect(villageSceneCaption(scene, 'fr')).toMatch(
      /^Illustration IA du village simulé à 12 h — /
    );
    expect(villageSceneCaption(scene, 'fr')).toContain('clinique : ');
    expect(villageSceneCaption(scene, 'en')).toContain('clinic: ');
  });
});
