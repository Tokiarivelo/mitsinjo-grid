'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { getSolarDrop, sweep } from '@mitsinjo/engine';
import type {
  SimulationInput,
  StrategyId,
  SweepConfig,
  SweepParam,
  SweepResult,
} from '@mitsinjo/engine';
import { findDivergencePoint } from '../utils/divergence';
import type { DivergenceInfo } from '../utils/divergence';

export interface UseSensitivitySweepResult {
  selectedParam: SweepParam;
  setSelectedParam: (param: SweepParam) => void;
  sweepResult: SweepResult;
  divergence: DivergenceInfo;
  currentValue: number;
  config: SweepConfig;
}

export function useSensitivitySweep(
  input: SimulationInput,
  strategies: readonly StrategyId[]
): UseSensitivitySweepResult {
  const [selectedParam, setSelectedParam] = useState<SweepParam>('solarDropPct');

  const deferredInput = useDeferredValue(input);
  const deferredParam = useDeferredValue(selectedParam);
  const deferredStrategies = useDeferredValue(strategies);

  const { config, currentValue } = useMemo(() => {
    if (deferredParam === 'solarDropPct') {
      const drop = getSolarDrop(deferredInput);
      return {
        config: {
          param: 'solarDropPct' as const,
          from: 0,
          to: 80,
          step: 10,
        },
        currentValue: drop.pct,
      };
    }

    if (deferredParam === 'demandMultiplier') {
      return {
        config: {
          param: 'demandMultiplier' as const,
          from: 0.6,
          to: 1.8,
          step: 0.1,
        },
        currentValue: Math.round(deferredInput.demandMultiplier * 10) / 10,
      };
    }

    // initialSocPct
    const minSafeFrom = Math.min(
      90,
      Math.max(25, Math.ceil((deferredInput.battery.minSocPct + 5) / 5) * 5)
    );
    return {
      config: {
        param: 'initialSocPct' as const,
        from: minSafeFrom,
        to: 95,
        step: 5,
      },
      currentValue: deferredInput.battery.initialSocPct,
    };
  }, [deferredInput, deferredParam]);

  const sweepResult = useMemo(() => {
    try {
      return sweep(deferredInput, config, deferredStrategies);
    } catch {
      return [];
    }
  }, [deferredInput, config, deferredStrategies]);

  const divergence = useMemo(() => {
    return findDivergencePoint(sweepResult, 0.1, deferredStrategies);
  }, [sweepResult, deferredStrategies]);

  return {
    selectedParam,
    setSelectedParam,
    sweepResult,
    divergence,
    currentValue,
    config,
  };
}
