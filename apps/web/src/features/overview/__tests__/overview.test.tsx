import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverviewPage } from '../index';

describe('OverviewPage', () => {
  it('renders simulated data notice and heading', () => {
    render(<OverviewPage />);
    expect(screen.getByText('SIMULATED DATA')).toBeInTheDocument();
    expect(screen.getByText('Microgrid Overview')).toBeInTheDocument();
  });
});
