import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectorIcon, SECTOR_TEXT_CLASS } from '../sector-icon';
import { ViewModeToggle } from '../view-mode-toggle';

describe('SectorIcon', () => {
  it('is decorative and tinted with the sector token by default', () => {
    const { container } = render(<SectorIcon sector="health" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.getAttribute('class')).toContain(SECTOR_TEXT_CLASS.health);
  });

  it('keeps the parent color when not tinted', () => {
    const { container } = render(<SectorIcon sector="water" tinted={false} />);
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain(
      SECTOR_TEXT_CLASS.water
    );
  });
});

describe('ViewModeToggle', () => {
  const options = [
    { id: '3d' as const, label: '3D' },
    { id: 'circuit' as const, label: 'Circuit' },
  ];

  it('marks the active option pressed and reports clicks', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle options={options} value="3d" onChange={onChange} label="View" />);
    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Circuit' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Circuit' }));
    expect(onChange).toHaveBeenCalledWith('circuit');
  });
});
