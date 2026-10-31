import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverageRing } from '../ui/coverage-ring';

describe('CoverageRing', () => {
  it('shows the engine value and names it for screen readers', () => {
    render(<CoverageRing pct={87.34} tone="critical" label="Proportional" caption="met" />);
    expect(screen.getByRole('img', { name: 'Proportional: 87.3 %' })).toBeInTheDocument();
    expect(screen.getByText('87.3')).toBeInTheDocument();
  });

  it('shows 100 without decimals and clamps out-of-range values', () => {
    const { rerender } = render(<CoverageRing pct={100} tone="safe" label="A" caption="c" />);
    expect(screen.getByText('100')).toBeInTheDocument();
    rerender(<CoverageRing pct={140} tone="safe" label="A" caption="c" />);
    expect(screen.getByText('100')).toBeInTheDocument();
    rerender(<CoverageRing pct={-5} tone="critical" label="A" caption="c" />);
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });
});
