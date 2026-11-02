import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../utils/poster-export', () => ({
  exportPosterPng: vi.fn(async () => true),
}));
import { exportPosterPng } from '../../utils/poster-export';
import { DayComicBlock } from '../day-comic-block';
import type { CopilotVisual } from '../../types';

const COMIC: CopilotVisual = {
  kind: 'day_comic',
  imageUrl: 'https://img.example/comic.webp',
  caption: 'The day in four panels',
  overlay: {
    cuts: [],
    panels: [
      { hour: 7, sky: 'sunny', cuts: false },
      { hour: 12, sky: 'overcast', cuts: false },
      { hour: 17, sky: 'partly_cloudy', cuts: true },
      { hour: 21, sky: 'night', cuts: true },
    ],
  },
  resultId: 'SIM-1',
};

describe('DayComicBlock (M12-T3)', () => {
  it('overlays the engine panel hours and states on the number-free strip', () => {
    render(<DayComicBlock visual={COMIC} />);
    expect(screen.getByText('Day in four panels')).toBeInTheDocument();
    expect(screen.getByText(/07:00 · sunny · powered/)).toBeInTheDocument();
    expect(screen.getByText(/12:00 · overcast · powered/)).toBeInTheDocument();
    expect(screen.getByText(/17:00 · partly cloudy · cuts/)).toBeInTheDocument();
    expect(screen.getByText(/21:00 · night · cuts/)).toBeInTheDocument();
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
  });

  it('exports the strip with the panel lines', async () => {
    render(<DayComicBlock visual={COMIC} />);
    fireEvent.click(screen.getByRole('button', { name: /export png/i }));
    expect(exportPosterPng).toHaveBeenCalledWith(
      COMIC.imageUrl,
      expect.arrayContaining([expect.stringContaining('07:00')]),
      'comic-SIM-1.png'
    );
  });
});
