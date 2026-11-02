import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { ObjectDisplayControls } from '../ui/object-display-controls';

const renderControls = (props?: Partial<Parameters<typeof ObjectDisplayControls>[0]>) => {
  const onScale = vi.fn();
  const onTint = vi.fn();
  const onReset = vi.fn();
  render(
    <I18nProvider>
      <ObjectDisplayControls
        scale={1}
        tint={null}
        onScale={onScale}
        onTint={onTint}
        onReset={onReset}
        {...props}
      />
    </I18nProvider>
  );
  return { onScale, onTint, onReset };
};

describe('ObjectDisplayControls (PV-T11b)', () => {
  it('slider and tint picker call back; reset only shows once tweaked', () => {
    const { onScale, onTint } = renderControls();
    expect(screen.queryByRole('button', { name: 'Reset view' })).toBeNull();
    fireEvent.change(screen.getByRole('slider', { name: 'Model size' }), {
      target: { value: '1.5' },
    });
    expect(onScale).toHaveBeenCalledWith(1.5);
    fireEvent.change(screen.getByLabelText('Tint'), { target: { value: '#ff0000' } });
    expect(onTint).toHaveBeenCalledWith('#ff0000');
  });

  it('reset restores size and measured colours', () => {
    const { onReset } = renderControls({ scale: 1.5, tint: '#ff0000' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
