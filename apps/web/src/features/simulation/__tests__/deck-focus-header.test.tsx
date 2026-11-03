import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckFocusHeader } from '../ui/deck-focus-header';

describe('DeckFocusHeader', () => {
  it('toggle and close are sibling buttons, not nested (regression)', () => {
    const onToggle = vi.fn();
    const onClose = vi.fn();
    render(<DeckFocusHeader expanded={false} title="Deck" onToggle={onToggle} onClose={onClose} />);

    const toggle = screen.getByRole('button', { name: /expand controls/i });
    const close = screen.getByRole('button', { name: /close/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.contains(close)).toBe(false);
    expect(screen.getByRole('heading', { name: /deck/i })).toContainElement(toggle);

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the collapse label when expanded', () => {
    render(<DeckFocusHeader expanded title="Deck" onToggle={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /collapse controls/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});
