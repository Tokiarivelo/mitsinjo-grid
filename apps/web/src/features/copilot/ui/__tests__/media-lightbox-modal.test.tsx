import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaLightboxModal } from '../media-lightbox-modal';

describe('MediaLightboxModal', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(
      <MediaLightboxModal
        isOpen={false}
        media={{ url: 'https://example.com/test.png', type: 'image' }}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders image lightbox with zoom, canvas toggle, and download controls', () => {
    const onClose = vi.fn();
    render(
      <MediaLightboxModal
        isOpen={true}
        media={{
          url: 'https://example.com/test.png',
          type: 'image',
          title: 'Solar Inverter Inspection',
          caption: 'High resolution visual',
        }}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Solar Inverter Inspection')).toBeInTheDocument();
    expect(screen.getByText('High resolution visual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /canvas inspector/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close lightbox/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to canvas mode and shows grid toggle', () => {
    render(
      <MediaLightboxModal
        isOpen={true}
        media={{
          url: 'https://example.com/test.png',
          type: 'image',
          title: 'Solar Inverter Inspection',
        }}
        onClose={vi.fn()}
      />
    );

    const canvasToggle = screen.getByRole('button', { name: /canvas inspector/i });
    fireEvent.click(canvasToggle);

    expect(screen.getByRole('button', { name: /grid overlay/i })).toBeInTheDocument();
  });

  it('renders video element when media is a video', () => {
    render(
      <MediaLightboxModal
        isOpen={true}
        media={{
          url: 'https://example.com/simulation.mp4',
          type: 'video',
          title: '24h Simulation Run',
        }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('24h Simulation Run')).toBeInTheDocument();
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/simulation.mp4');
  });

  it('overlays segmentation masks on the photo (M8-T1)', () => {
    const { container } = render(
      <MediaLightboxModal
        isOpen={true}
        media={{
          url: 'https://example.com/roof.png',
          type: 'image',
          title: 'Roof',
          masks: [
            { outline: 'M0.1 0.1H0.5V0.4H0.1Z', imageWidth: 1000, imageHeight: 800 },
            {
              box: { x1: 100, y1: 80, x2: 500, y2: 400 },
              imageWidth: 1000,
              imageHeight: 800,
            },
          ],
        }}
        onClose={vi.fn()}
      />
    );
    const paths = container.querySelectorAll('svg[data-masks] path');
    expect(paths).toHaveLength(2);
    // Outline used as-is; pixel box converted to 0–1 fractions.
    expect(paths[0]).toHaveAttribute('d', 'M0.1 0.1H0.5V0.4H0.1Z');
    expect(paths[1]).toHaveAttribute('d', 'M0.1 0.1H0.5V0.5H0.1Z');
  });
});
