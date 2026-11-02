import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../utils/poster-export', () => ({
  exportPosterPng: vi.fn(async () => true),
}));
import { exportPosterPng } from '../../utils/poster-export';
import { SheddingPosterBlock } from '../shedding-poster-block';
import type { CopilotVisual } from '../../types';

const POSTER: CopilotVisual = {
  kind: 'shedding_poster',
  imageUrl: 'https://img.example/poster.webp',
  caption: 'Load-shedding poster background',
  overlay: {
    cuts: [
      { sector: 'market', fromHour: 18, toHour: 22, unservedKwh: 4.2 },
      { sector: 'school', fromHour: 19, toHour: 21, unservedKwh: 1.1 },
    ],
  },
  resultId: 'SIM-1',
};

describe('SheddingPosterBlock (M5-T3)', () => {
  it('overlays the engine cut hours on the number-free image', () => {
    render(<SheddingPosterBlock visual={POSTER} />);
    // Done-when: the hours shown ARE the engine overlay (exact from/to per cut).
    expect(screen.getByText(/18:00–22:00/)).toBeInTheDocument();
    expect(screen.getByText(/19:00–21:00/)).toBeInTheDocument();
    expect(screen.getByText(/Local Market & Artisans/)).toBeInTheDocument();
    expect(screen.getByText(/Primary School/)).toBeInTheDocument();
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
  });

  it('no cuts → announcement line, no hour ranges', () => {
    render(<SheddingPosterBlock visual={{ ...POSTER, overlay: { cuts: [] } }} />);
    expect(screen.getByText('No cut to announce')).toBeInTheDocument();
    expect(screen.queryByText(/\d{2}:00–\d{2}:00/)).toBeNull();
  });

  it('export sends the poster lines with the engine hours to PNG', async () => {
    render(<SheddingPosterBlock visual={POSTER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export PNG' }));
    expect(exportPosterPng).toHaveBeenCalledTimes(1);
    const [url, lines, filename] = (exportPosterPng as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
      string,
    ];
    expect(url).toBe('https://img.example/poster.webp');
    expect(lines.join('\n')).toContain('18:00–22:00');
    expect(lines.join('\n')).toContain('19:00–21:00');
    expect(filename).toContain('SIM-1');
  });

  it('click on the picture opens the lightbox', () => {
    const onMediaClick = vi.fn();
    render(<SheddingPosterBlock visual={POSTER} onMediaClick={onMediaClick} />);
    fireEvent.click(screen.getByRole('img', { name: 'Load-shedding poster background' }));
    expect(onMediaClick).toHaveBeenCalledWith({
      url: 'https://img.example/poster.webp',
      type: 'image',
      title: 'Load-shedding poster background',
      caption: 'Load-shedding poster background',
    });
  });
});
