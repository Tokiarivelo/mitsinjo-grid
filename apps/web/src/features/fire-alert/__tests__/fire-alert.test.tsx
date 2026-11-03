import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import {
  FIRE_SNACKBAR_MS,
  FireAlertLayer,
  ReportFireControl,
  useActiveFires,
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

describe('reportFire on a multi-day run (regression: fire gone each night)', () => {
  beforeEach(() => resetSimulationStore());

  it('keeps burning on the next day from midnight, and a restore puts it out', () => {
    const store = useSimulationStore.getState();
    store.addWorkflowDay('sunny');
    store.addWorkflowDay('sunny');
    store.run();
    useSimulationStore.getState().setDayIndex(0);
    useSimulationStore.setState({ timeIndex: 14 });
    useSimulationStore.getState().reportFire('school');

    let s = useSimulationStore.getState();
    // Not an every-day input event any more: it lives on the days.
    expect(s.input.events.some((e) => e.type === 'fire')).toBe(false);
    const school = (day: number, hour: number) =>
      s.workflowResults[s.activeStrategy]?.days[day]?.result.steps[hour]?.sectors.school?.servedKw;
    expect(school(0, 13)).toBeGreaterThan(0);
    expect(school(0, 14)).toBe(0);
    expect(school(1, 0)).toBe(0);
    expect(school(2, 9)).toBe(0);

    // The alert follows the day shown: still burning at 03:00 on day 2.
    useSimulationStore.getState().setDayIndex(1);
    useSimulationStore.setState({ timeIndex: 3 });
    const { result } = renderHook(() => useActiveFires());
    expect(result.current.map((f) => f.sector)).toEqual(['school']);
    // Same fire across midnight: same key, so no new snackbar each day.
    expect(result.current[0]?.key).toBe('fire:school');

    act(() => useSimulationStore.getState().applyProposal({ clearFires: ['school'] }));
    s = useSimulationStore.getState();
    expect(school(2, 9)).toBeGreaterThan(0);
  });
});

describe('a fire keeps burning past midnight on the playback (regression)', () => {
  beforeEach(() => resetSimulationStore());

  it('single day: after 23 h → 0 h the sector still burns at every hour until restored', () => {
    useSimulationStore.getState().run();
    useSimulationStore.setState({ timeIndex: 14 });
    useSimulationStore.getState().reportFire('market');
    useSimulationStore.setState({ timeIndex: 23 });
    useSimulationStore.getState().advancePlayback();

    const s = useSimulationStore.getState();
    expect(s.timeIndex).toBe(0);
    const steps = s.results[s.activeStrategy]!.steps;
    // Before: served again from 0 h to 13 h, then cut again at 14 h.
    for (const step of steps) expect(step.sectors.market?.servedKw).toBe(0);
    const { result } = renderHook(() => useActiveFires());
    expect(result.current.map((f) => f.sector)).toEqual(['market']);

    act(() => useSimulationStore.getState().applyProposal({ clearFires: ['market'] }));
    const after = useSimulationStore.getState();
    expect(
      after.results[after.activeStrategy]!.steps[12]!.sectors.market?.servedKw
    ).toBeGreaterThan(0);
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

  it('voice preset opens the list with the detected sector highlighted (M3-T3)', () => {
    render(
      <I18nProvider>
        <ReportFireControl variant="hud" defaultOpenSector="school" />
      </I18nProvider>
    );
    // Open at once, no click: one click confirms.
    expect(screen.getByText('Which sector is on fire?')).toBeInTheDocument();
    expect(screen.getByText('Detected from your voice — one click to confirm')).toBeInTheDocument();
    const row = screen.getByRole('button', { name: 'Primary School' });
    expect(row.className).toContain('ring-critical-red');
    fireEvent.click(row);
    expect(useSimulationStore.getState().input.events.some((e) => e.type === 'fire')).toBe(true);
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

  it('renders critical alert banner and snackbar for critical_forecast incidents (PA-T4c)', async () => {
    const { FireAlertBanner } = await import('../ui/fire-alert-banner');
    const { FireSnackbars } = await import('../ui/fire-snackbars');

    const forecastAlert = {
      key: 'critical_forecast:health:18',
      sector: 'health' as const,
      startHour: 18,
      kind: 'critical_forecast',
    };

    render(
      <I18nProvider>
        <FireAlertBanner fires={[forecastAlert]} />
        <FireSnackbars items={[forecastAlert]} onDismiss={vi.fn()} />
      </I18nProvider>
    );

    // Shows critical alert banner & snackbar
    const banners = screen.getAllByRole('alert');
    expect(banners.some((b) => b.textContent?.includes('CRITICAL ALERT: Health Clinic'))).toBe(
      true
    );
    expect(screen.getAllByText(/Power shortfall forecasted at hour 18:00/)).toHaveLength(2);
  });
});
