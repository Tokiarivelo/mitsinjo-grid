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
});
