import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { PlaceMinimap } from '../ui/place-minimap';
import { KEEP_OUT_ZONES } from '@/features/microgrid-3d/utils/landscape';

const rect = (width = 230, height = 230) =>
  ({ left: 0, top: 0, width, height, right: width, bottom: height }) as DOMRect;

function setup(value: { x: number; z: number } | null = null) {
  const onPlace = vi.fn();
  const utils = render(
    <I18nProvider>
      <PlaceMinimap value={value} sector="water" onPlace={onPlace} />
    </I18nProvider>
  );
  return { ...utils, onPlace, map: screen.getByRole('application', { name: 'Village map' }) };
}

describe('PlaceMinimap (PP-T4)', () => {
  it('shows the six buildings, the help and the placed dot', () => {
    const { container } = setup({ x: 30, z: 30 });
    // Terrain disc + 6 buildings + placed dot + cursor ring.
    expect(container.querySelectorAll('svg circle').length).toBe(9);
    expect(screen.getByText('Arrows move the cursor. Enter places.')).toBeTruthy();
  });

  it('click sets the spot (client px → map units)', () => {
    const { map, onPlace } = setup();
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue(rect());
    // Centre of a 230 px map = village centre.
    fireEvent.click(map, { clientX: 115, clientY: 115 });
    expect(onPlace).toHaveBeenCalledWith({ x: 0, z: 0 });
    // Top-left corner clamps into the map square.
    fireEvent.click(map, { clientX: 0, clientY: 0 });
    expect(onPlace).toHaveBeenCalledWith({ x: -113, z: -113 });
  });

  it('keyboard: arrows move the cursor (announced), Enter places', () => {
    const { map, onPlace } = setup();
    // Cursor starts on the sector building: water (−8, 2).
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    expect(screen.getByText('Cursor: -6.0, 2.0')).toBeTruthy();
    fireEvent.keyDown(map, { key: 'ArrowDown', shiftKey: true });
    expect(screen.getByText('Cursor: -6.0, 12.0')).toBeTruthy();
    expect(onPlace).not.toHaveBeenCalled();
    fireEvent.keyDown(map, { key: 'Enter' });
    expect(onPlace).toHaveBeenCalledWith({ x: -6, z: 12 });
  });

  it('draws placed objects (not its own) and warns when the cursor is on an obstacle (PI-T3)', () => {
    const zones = [
      ...KEEP_OUT_ZONES,
      { id: 'other', x: 30, z: 30, r: 2 },
      { id: 'me', x: 0, z: 40, r: 2 },
    ];
    const { container } = render(
      <I18nProvider>
        <PlaceMinimap value={null} sector="water" onPlace={vi.fn()} zones={zones} excludeId="me" />
      </I18nProvider>
    );
    // Terrain disc + 6 buildings + 1 placed object + cursor ring.
    expect(container.querySelectorAll('svg circle').length).toBe(9);
    // Cursor starts on the water building: blocked.
    expect(screen.getByText(/Spot taken/)).toBeTruthy();
  });
});
