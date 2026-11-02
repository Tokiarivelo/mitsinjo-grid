import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConstitutionCard } from '../constitution-card';

describe('ConstitutionCard (M10-T2)', () => {
  it('lists the default rules in plain words with the verified-by-code note', () => {
    render(<ConstitutionCard />);
    expect(screen.getByRole('region', { name: /village constitution/i })).toBeInTheDocument();
    expect(screen.getByText(/health clinic is never cut/i)).toBeInTheDocument();
    expect(screen.getByText(/keeps at least .* kW/i)).toBeInTheDocument();
    expect(screen.getByText(/verified by code/i)).toBeInTheDocument();
  });
});
