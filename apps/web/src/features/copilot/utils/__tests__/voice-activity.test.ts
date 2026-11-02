import { describe, it, expect } from 'vitest';
import { createSpeechEndDetector } from '../voice-activity';

describe('createSpeechEndDetector (M3-T5, fixed frames)', () => {
  it('never ends on silence alone (mic tapped by mistake)', () => {
    const detect = createSpeechEndDetector({ threshold: 0.02, silenceMs: 1000 });
    for (let t = 0; t <= 5000; t += 100) expect(detect.push(0.001, t)).toBe(false);
  });

  it('ends after the silence budget past the last speech frame', () => {
    const detect = createSpeechEndDetector({ threshold: 0.02, silenceMs: 1000 });
    expect(detect.push(0.1, 0)).toBe(false);
    expect(detect.push(0.12, 100)).toBe(false);
    expect(detect.push(0.001, 500)).toBe(false);
    expect(detect.push(0.001, 1099)).toBe(false);
    expect(detect.push(0.001, 1100)).toBe(true);
    expect(detect.push(0.001, 2000)).toBe(true); // latched until reset
  });

  it('a short pause does not end the turn', () => {
    const detect = createSpeechEndDetector({ threshold: 0.02, silenceMs: 1000 });
    detect.push(0.1, 0);
    expect(detect.push(0.001, 500)).toBe(false);
    expect(detect.push(0.09, 900)).toBe(false);
    expect(detect.push(0.001, 1500)).toBe(false);
    expect(detect.push(0.001, 1900)).toBe(true);
  });

  it('reset starts a new turn', () => {
    const detect = createSpeechEndDetector({ threshold: 0.02, silenceMs: 1000 });
    detect.push(0.1, 0);
    expect(detect.push(0.001, 2000)).toBe(true);
    detect.reset();
    expect(detect.push(0.001, 3000)).toBe(false);
  });
});
