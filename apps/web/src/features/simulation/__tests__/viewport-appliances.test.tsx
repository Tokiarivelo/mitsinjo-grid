import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { scenarios, type SimulationInput } from '@mitsinjo/engine';
import { VillageViewport } from '../ui/village-viewport';

// Real 3D needs WebGL: stub the canvas and expose the camera props it receives.
vi.mock('@/features/microgrid-3d', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/microgrid-3d')>();
  return {
    ...actual,
    useWebGLAvailable: () => true,
    LazyVillageCanvas: ({
      focusApplianceId,
      panMode,
    }: {
      focusApplianceId?: string | null;
      panMode?: boolean;
    }) => (
      <div
        data-testid="canvas"
        data-focus={focusApplianceId ?? ''}
        data-pan={panMode ? 'on' : 'off'}
      />
    ),
  };
});

const input: SimulationInput = {
  ...scenarios.baseline.input,
  appliances: [
    {
      id: 'mill',
      name: 'Rice mill',
      category: 'rice_mill',
      sector: 'market',
      watts: 3000,
      quantity: 1,
      position: { x: 14, z: 6 },
    },
  ],
};

describe('VillageViewport 3D: inserted appliances and hand tool', () => {
  it('lists the appliance next to the sectors and frames it on click', () => {
    const onSelect = vi.fn();
    render(
      <VillageViewport
        input={input}
        selectedSector={null}
        onSelectSector={onSelect}
        timeIndex={12}
      />
    );
    const chip = screen.getByRole('button', { name: 'Show Rice mill in the 3D view' });
    expect(chip).toHaveTextContent('Rice mill');
    fireEvent.click(chip);
    expect(screen.getByTestId('canvas').dataset.focus).toBe('mill');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    // A sector chip takes the camera back.
    fireEvent.click(screen.getByRole('button', { name: /Local Market/ }));
    expect(screen.getByTestId('canvas').dataset.focus).toBe('');
    expect(onSelect).toHaveBeenCalledWith('market');
  });

  it('the hand tool switches drag from orbit to pan', () => {
    render(
      <VillageViewport
        input={input}
        selectedSector={null}
        onSelectSector={() => {}}
        timeIndex={12}
      />
    );
    expect(screen.getByTestId('canvas').dataset.pan).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: 'Hand tool: drag to move the view' }));
    expect(screen.getByTestId('canvas').dataset.pan).toBe('on');
    expect(screen.getByText(/Drag to move the view/)).toBeInTheDocument();
  });
});
