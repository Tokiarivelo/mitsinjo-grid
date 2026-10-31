import { describe, it, expect } from 'vitest';
import { parseMessageSections } from '../parse-sections';

describe('parseMessageSections', () => {
  it('splits the four sections', () => {
    expect(
      parseMessageSections(
        '### What happened\nA\n\n### Computed evidence\nB\n\n### Why it matters\nC\n\n### Explore next\nD'
      )
    ).toEqual({ whatHappened: 'A', computedEvidence: 'B', whyItMatters: 'C', exploreNext: 'D' });
  });

  it('a missing section does not swallow the next one (regression: "Explore next" shown twice)', () => {
    expect(parseMessageSections('### What happened\nA\n\n### Explore next\nD')).toEqual({
      whatHappened: 'A',
      exploreNext: 'D',
    });
  });

  it('reads French and Malagasy headings', () => {
    expect(parseMessageSections("### Ce qui s'est passé\nA\n### Et ensuite\nD")).toEqual({
      whatHappened: 'A',
      exploreNext: 'D',
    });
    expect(parseMessageSections('### Inona no nitranga\nA\n### Porofo voakajy\nB')).toEqual({
      whatHappened: 'A',
      computedEvidence: 'B',
    });
  });

  it('keeps other headings and text before the first section', () => {
    expect(
      parseMessageSections('Intro\n### What happened\nA\n### Table\n| x |\n### Explore next\nD')
    ).toEqual({ whatHappened: 'Intro\nA\n### Table\n| x |', exploreNext: 'D' });
  });

  it('plain text without headings goes to whatHappened', () => {
    expect(parseMessageSections('Just text')).toEqual({ whatHappened: 'Just text' });
    expect(parseMessageSections('')).toEqual({});
  });
});
