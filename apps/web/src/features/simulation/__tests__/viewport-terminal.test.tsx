import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { scenarios } from '@mitsinjo/engine';
import { VillageViewport } from '../ui/village-viewport';

describe('VillageViewport full screen: glass copilot terminal', () => {
  let current: Element | null = null;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ sessions: [], models: ['auto'] }) }))
    );
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => current,
    });
    document.documentElement.requestFullscreen = vi.fn();
    const enter = (el: Element) => {
      current = el;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    HTMLElement.prototype.requestFullscreen = vi.fn(async function (this: HTMLElement) {
      enter(this);
    });
    document.exitFullscreen = vi.fn(async () => {
      current = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
  });
  afterEach(() => {
    current = null;
    vi.unstubAllGlobals();
  });

  it('shows the terminal only in full screen, and the Copilot button toggles it', async () => {
    render(
      <VillageViewport
        input={scenarios.baseline.input}
        selectedSector={null}
        onSelectSector={() => {}}
        timeIndex={12}
      />
    );
    // Card view: no terminal, no toggle.
    expect(screen.queryByRole('region', { name: 'mitsinjo · copilot' })).toBeNull();
    expect(screen.queryByRole('button', { name: /copilot terminal/i })).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: /full screen/i })));
    expect(screen.getByRole('region', { name: 'mitsinjo · copilot' })).toBeInTheDocument();

    const toggle = screen.getAllByRole('button', { name: 'Hide the copilot terminal' })[0]!;
    fireEvent.click(toggle);
    expect(screen.queryByRole('region', { name: 'mitsinjo · copilot' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open the copilot terminal' }));
    expect(screen.getByRole('region', { name: 'mitsinjo · copilot' })).toBeInTheDocument();
  });

  const screenWidth = (wide: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: wide, addEventListener() {}, removeEventListener() {} }))
    );

  it('phones show one glass panel at a time', async () => {
    screenWidth(false);
    render(
      <VillageViewport
        input={scenarios.baseline.input}
        selectedSector={null}
        onSelectSector={() => {}}
        timeIndex={12}
        fullscreenDock={({ compact, onToggleCompact }) => (
          <button type="button" onClick={onToggleCompact}>
            {compact ? 'dock compact' : 'timeline dock'}
          </button>
        )}
        fullscreenControls={<p>controls body</p>}
      />
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /full screen/i })));
    // Terminal open → no drawer, no dock.
    expect(screen.getByRole('region', { name: 'mitsinjo · copilot' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Simulation controls' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the simulation controls' }));
    expect(screen.getByRole('region', { name: 'Simulation controls' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'mitsinjo · copilot' })).toBeNull();
  });

  it('full screen shows the docked timeline and a toggleable Controls drawer', async () => {
    screenWidth(true);
    render(
      <VillageViewport
        input={scenarios.baseline.input}
        selectedSector={null}
        onSelectSector={() => {}}
        timeIndex={12}
        fullscreenDock={({ compact, onToggleCompact }) => (
          <button type="button" onClick={onToggleCompact}>
            {compact ? 'dock compact' : 'timeline dock'}
          </button>
        )}
        fullscreenControls={<p>controls body</p>}
      />
    );
    expect(screen.queryByText('timeline dock')).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /full screen/i })));

    expect(screen.getByText('timeline dock')).toBeInTheDocument();
    const labelsBefore = screen.queryAllByText('SIMULATED DATA').length;
    // Minimized: the dock gets compact=true and the stats strip goes away.
    fireEvent.click(screen.getByText('timeline dock'));
    expect(screen.getByText('dock compact')).toBeInTheDocument();
    expect(screen.queryAllByText('SIMULATED DATA')).toHaveLength(labelsBefore - 1);
    const drawer = screen.getByRole('region', { name: 'Simulation controls' });
    expect(drawer).toHaveTextContent('controls body');
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide the simulation controls' })[0]!);
    expect(screen.queryByRole('region', { name: 'Simulation controls' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the simulation controls' }));
    expect(screen.getByRole('region', { name: 'Simulation controls' })).toBeInTheDocument();
  });
});
