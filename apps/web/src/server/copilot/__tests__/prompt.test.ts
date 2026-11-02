import { describe, it, expect } from 'vitest';
import { appHourNote, getSystemPrompt, parseAppHour } from '../prompt';

describe('placed loads rule (PP-T7)', () => {
  it.each([
    ['en', getSystemPrompt('en')],
    ['fr', getSystemPrompt('fr')],
    ['mg', getSystemPrompt('mg')],
  ] as const)('reports the feeder, never invents positions (%s)', (_locale, prompt) => {
    expect(prompt).toContain('2b.');
    expect(prompt).toContain('feeder');
    expect(prompt).toContain('x/z');
  });
});

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
