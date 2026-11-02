import { describe, expect, it } from 'vitest';
import { redactDataUrls, redactDataUrlsInText } from '../vision-log';

describe('vision log redaction', () => {
  it('data URLs become a short placeholder, everything else logs verbatim', () => {
    const payload = {
      label: 'beige house',
      aspect: 0.75,
      crop: `data:image/jpeg;base64,${'A'.repeat(100)}`,
      link: 'https://r2.example/vision/x.jpg',
      nested: { other: 'data:text/plain;base64,SGVsbG8=' },
    };
    expect(JSON.parse(JSON.stringify(payload, redactDataUrls))).toEqual({
      label: 'beige house',
      aspect: 0.75,
      crop: '[image data-url, 123 chars]',
      link: 'https://r2.example/vision/x.jpg',
      nested: { other: '[image data-url, 31 chars]' },
    });
    // Standalone use for a single image argument.
    expect(redactDataUrls('image', payload.crop)).toBe('[image data-url, 123 chars]');
    expect(redactDataUrls('image', payload.link)).toBe(payload.link);
  });

  it('raw model text keeps its content, embedded data URLs do not leak', () => {
    expect(redactDataUrlsInText('{"archetype":"house"}')).toBe('{"archetype":"house"}');
    const sneaky = `see data:image/png;base64,${'B'.repeat(64)} here`;
    expect(redactDataUrlsInText(sneaky)).toBe('see [image data-url, 86 chars] here');
  });
});
