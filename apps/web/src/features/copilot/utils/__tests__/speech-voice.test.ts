import { describe, it, expect } from 'vitest';
import { pickSpeechVoice } from '../speech-voice';

const FR = { lang: 'fr-FR', name: 'Google français' };
const FR_CA = { lang: 'fr-CA', name: 'Amélie' };
const EN = { lang: 'en-US', name: 'Google US English' };
const MG = { lang: 'mg-MG', name: 'Malagasy' };

describe('pickSpeechVoice (M3-T4)', () => {
  it('prefers a voice of the message language', () => {
    expect(pickSpeechVoice([EN, FR_CA, FR], 'fr')).toBe(FR_CA);
    expect(pickSpeechVoice([FR, EN], 'en')).toBe(EN);
    expect(pickSpeechVoice([EN, MG], 'mg')).toBe(MG);
  });

  it('matches the base language whatever the region', () => {
    expect(pickSpeechVoice([FR], 'fr-MG')).toBe(FR);
    expect(pickSpeechVoice([{ lang: 'en', name: 'English' }], 'en')).toEqual({
      lang: 'en',
      name: 'English',
    });
  });

  it('returns null when no voice speaks the language (MG: text only)', () => {
    expect(pickSpeechVoice([EN, FR], 'mg')).toBeNull();
    expect(pickSpeechVoice([], 'fr')).toBeNull();
  });
});
