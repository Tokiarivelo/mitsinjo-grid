import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasSketchDialog } from '../canvas-sketch-dialog';

describe('CanvasSketchDialog', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(
      <CanvasSketchDialog isOpen={false} onClose={vi.fn()} onAttach={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders sketch dialog with drawing tools and canvas', () => {
    const onClose = vi.fn();
    const onAttach = vi.fn();
    render(<CanvasSketchDialog isOpen={true} onClose={onClose} onAttach={onAttach} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Interactive Canvas Studio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pen$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^eraser$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear canvas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attach drawing to message/i })).toBeInTheDocument();

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Attach drawing
    const attachBtn = screen.getByRole('button', { name: /attach drawing to message/i });
    fireEvent.click(attachBtn);
    expect(onAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image',
        url: expect.any(String),
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
