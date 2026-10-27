import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { scenarios, simulate } from '@mitsinjo/engine';
import { VillageViewport } from '@/features/simulation/ui/village-viewport';

// Force the 3D branch; the lazy canvas itself never mounts in jsdom.
vi.mock('../hooks/use-webgl-available', () => ({ useWebGLAvailable: () => true }));

describe('VillageViewport 3D mode (PR #10 review)', () => {
  const input = scenarios.baseline.input;
  const result = simulate(input, 'proportional');

  it('shows the scenario-modified notice when the store is modified', () => {
    render(
      <VillageViewport
        input={input}
        result={result}
        selectedSector={null}
        onSelectSector={vi.fn()}
        timeIndex={12}
        isModified
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(/scenario modified/i);
  });

  it('marks the chosen camera preset as pressed and keeps reset available', () => {
    render(
      <VillageViewport
        input={input}
        result={result}
        selectedSector={null}
        onSelectSector={vi.fn()}
        timeIndex={12}
      />
    );
    const solar = screen.getByRole('button', { name: /^solar$/i });
    fireEvent.click(solar);
    expect(solar).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /reset camera/i })).toBeInTheDocument();
    expect(screen.getByText(/click a building to inspect/i)).toBeInTheDocument();
  });
});
