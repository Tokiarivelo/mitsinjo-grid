import { describe, it, expect } from 'vitest';
import { detectAdaptiveRoute, pickChatModel } from '../adaptive-router';

describe('Adaptive router: structural rules only (wording is left to Spark tool calls)', () => {
  const metaModels = [
    'muse-spark-1.3',
    'muse-wonder-1.0',
    'muse-image-1.0',
    'muse-spark-1.2',
    'sam-3.1',
  ];

  it('starts every auto turn on the Spark chat model, whatever the wording', () => {
    for (const ctx of [{}, { hasImage: false }]) {
      const r = detectAdaptiveRoute('auto', metaModels, ctx);
      expect(r).toMatchObject({ targetModel: 'muse-spark-1.3', modality: 'chat' });
    }
  });

  it('uses the vision modality (same Spark model) when an image is attached', () => {
    const r = detectAdaptiveRoute('auto', metaModels, { hasImage: true });
    expect(r).toMatchObject({ targetModel: 'muse-spark-1.3', modality: 'vision' });
  });

  it('honors an explicit model choice', () => {
    expect(detectAdaptiveRoute('muse-image-1.0', metaModels).modality).toBe('image');
    expect(detectAdaptiveRoute('muse-wonder-1.0', metaModels).modality).toBe('reasoning');
    expect(detectAdaptiveRoute('muse-spark-1.2', metaModels)).toMatchObject({
      targetModel: 'muse-spark-1.2',
      modality: 'chat',
    });
  });

  it('falls back to the default Spark id when the account lists no Spark model', () => {
    expect(pickChatModel([])).toBe('muse-spark-1.3');
    expect(pickChatModel(['muse-spark-1.2'])).toBe('muse-spark-1.2');
  });
});
