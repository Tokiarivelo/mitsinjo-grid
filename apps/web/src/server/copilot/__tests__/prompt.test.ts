import { describe, it, expect } from 'vitest';
import { appHourNote, parseAppHour } from '../prompt';

describe('appHourNote (M1-T3, K2)', () => {
  it('tells the model which hour "now" is and round-trips through parseAppHour', () => {
    const note = appHourNote(14);
    expect(note).toContain('fromHour=14');
    expect(parseAppHour(note)).toBe(14);
    expect(parseAppHour(appHourNote(0))).toBe(0);
  });

  it('ignores other system notes', () => {
    expect(parseAppHour('Conversation so far: hour 9')).toBeUndefined();
  });
});
