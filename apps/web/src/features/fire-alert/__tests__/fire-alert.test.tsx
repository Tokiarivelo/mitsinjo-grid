import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import {
  FIRE_SNACKBAR_MS,
  FireAlertLayer,
  ReportFireControl,
  useFireSnackbars,
  type FireAlert,
} from '../index';

const school: FireAlert = { key: 'school:14', sector: 'school', startHour: 14 };
const market: FireAlert = { key: 'market:15', sector: 'market', startHour: 15 };

describe('reportFire (store, M2-T2)', () => {
  beforeEach(() => resetSimulationStore());

  it('adds a fire from the shown hour to the end of the day and re-runs the engine', () => {
    useSimulationStore.setState({ timeIndex: 14 });
    useSimulationStore.getState().reportFire('school');
    const s = useSimulationStore.getState();
    expect(s.input.events).toContainEqual({
      type: 'fire',
      sector: 'school',
      startHour: 14,
      durationH: 10,
    });
    expect(s.status).toBe('complete');
    const result = s.results[s.activeStrategy];
    expect(result?.steps[14]?.sectors.school?.servedKw).toBe(0);
    expect(result?.warnings.some((w) => w.code === 'FIRE_ISOLATION')).toBe(true);
    // Safety exception: not an approved change, nothing to undo.
    expect(s.changeHistory).toEqual([]);
  });

  it('a sector already burning is not reported twice', () => {
    useSimulationStore.setState({ timeIndex: 14 });
    useSimulationStore.getState().reportFire('school');
    useSimulationStore.getState().reportFire('school');
    expect(
      useSimulationStore.getState().input.events.filter((e) => e.type === 'fire')
    ).toHaveLength(1);
  });
});

describe('useFireSnackbars', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows each new fire once, hides it after the delay', () => {
    const { result, rerender } = renderHook(({ fires }) => useFireSnackbars(fires), {
      initialProps: { fires: [] as FireAlert[] },
    });
    expect(result.current.snackbars).toEqual([]);

    rerender({ fires: [school] });
    expect(result.current.snackbars).toEqual([school]);

    act(() => vi.advanceTimersByTime(FIRE_SNACKBAR_MS / 2));
    rerender({ fires: [school, market] });
    expect(result.current.snackbars).toEqual([school, market]);

    // The first one keeps its own timer (not restarted by the second).
    act(() => vi.advanceTimersByTime(FIRE_SNACKBAR_MS / 2));
    expect(result.current.snackbars).toEqual([market]);

    // Same fires again: no new notice.
    rerender({ fires: [school, market] });
    act(() => vi.advanceTimersByTime(FIRE_SNACKBAR_MS));
    expect(result.current.snackbars).toEqual([]);
  });

  it('dismiss hides at once; a fire that ends and comes back notifies again', () => {
    const { result, rerender } = renderHook(({ fires }) => useFireSnackbars(fires), {
      initialProps: { fires: [school] },
    });
    act(() => result.current.dismiss(school.key));
    expect(result.current.snackbars).toEqual([]);

    rerender({ fires: [] });
    rerender({ fires: [school] });
    expect(result.current.snackbars).toEqual([school]);
  });
});

describe('fire alarm UI', () => {
  beforeEach(() => resetSimulationStore());

  it('Report a fire → pick the sector → big warning + snackbar, sector disabled', () => {
    useSimulationStore.setState({ timeIndex: 15 });
    render(
      <I18nProvider>
        <FireAlertLayer />
        <ReportFireControl variant="panel" />
      </I18nProvider>
    );
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Report a fire' }));
    fireEvent.click(screen.getByRole('button', { name: 'Primary School' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('FIRE: Primary School cut off'))).toBe(true);
    expect(alerts.some((a) => a.textContent?.includes('Fire reported: Primary School'))).toBe(true);
    expect(screen.getByText('Simulated alarm')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the fire notice' }));
    expect(screen.queryByText('Fire reported: Primary School')).toBeNull();
    // The big warning stays while the fire burns.
    expect(screen.getByText('FIRE: Primary School cut off')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Report a fire' }));
    expect(screen.getByRole('button', { name: /Primary School/ })).toBeDisabled();
  });

  it('the warning appears by itself when the timeline reaches the fire hour', () => {
    useSimulationStore.setState({ timeIndex: 15 });
    useSimulationStore.getState().reportFire('market');
    useSimulationStore.setState({ timeIndex: 10 });
    render(
      <I18nProvider>
        <FireAlertLayer />
      </I18nProvider>
    );
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => useSimulationStore.getState().setTimeIndex(16));
    expect(screen.getByText(/FIRE: Local Market & Artisans cut off/)).toBeInTheDocument();
    expect(screen.getByText(/Fire reported: Local Market & Artisans/)).toBeInTheDocument();
  });
});
