import { describe, it, expect } from 'vitest';
import { detectVoiceFireOrder } from '../utils/detect-fire-order';

describe('detectVoiceFireOrder (M3-T3, fixed transcriptions)', () => {
  it.each([
    ["Au feu à l'école !", 'school'],
    ['Incendie au marché', 'market'],
    ["Afo ao amin'ny sekoly", 'school'],
    ['Fire at the water pumping station', 'water'],
    ["There's a fire at the clinic", 'health'],
    ['Au feu, la pompe à eau brûle', 'water'],
  ])('%s → %s', (text, sector) => {
    expect(detectVoiceFireOrder(text)).toBe(sector);
  });

  it.each([
    'Coupe le marché ce soir',
    'Au feu !',
    'Que se passe-t-il si le solaire baisse de 40 % ?',
    'Un nuage arrive, que se passe-t-il ?',
    'Compare the strategies',
  ])('%s → no fire order', (text) => {
    expect(detectVoiceFireOrder(text)).toBeNull();
  });
});
