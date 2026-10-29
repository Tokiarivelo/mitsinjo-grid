import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { scenarios, simulate } from '@mitsinjo/engine';
import { I18nProvider } from '@/lib/i18n';
import { toSceneModel } from '../../utils/to-scene-model';
import { useFeederLabels } from '../use-feeder-labels';

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;
const input = scenarios.essential_stress.input;
const result = simulate(input, 'proportional');

describe('useFeederLabels', () => {
  it('names each feeder with its breaker state and served kW', () => {
    const model = toSceneModel({ input, result, timeIndex: 12 });
    const { result: r } = renderHook(() => useFeederLabels(model), { wrapper });
    expect(r.current.titles.health).toMatch(/^Health/);
    expect(r.current.titles.health).toContain('kW');
  });

  it('flags a shed feeder in red at night under stress', () => {
    const model = toSceneModel({ input, result, timeIndex: 20 });
    expect(model.buildings.health.status).toBe('unserved');
    const { result: r } = renderHook(() => useFeederLabels(model), { wrapper });
    expect(r.current.tones.health).toBe('critical-red');
    expect(r.current.titles.health).toContain('0 kW');
  });
});
