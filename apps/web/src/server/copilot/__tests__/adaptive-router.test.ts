import { describe, it, expect } from 'vitest';
import { detectAdaptiveRoute } from '../adaptive-router';

describe('Adaptive Router for Meta Models', () => {
  const metaModels = [
    'muse-spark-1.3',
    'muse-wonder-1.0',
    'muse-image-1.0',
    'muse-spark-1.2',
    'muse-spark-1.1',
  ];

  it('routes image generation requests in French and English to muse-image-1.0', () => {
    const r1 = detectAdaptiveRoute(
      'Génère une image du micro-réseau solaire avec les panneaux',
      'auto',
      metaModels
    );
    expect(r1.modality).toBe('image');
    expect(r1.targetModel).toBe('muse-image-1.0');

    const r2 = detectAdaptiveRoute(
      'Generate a photo of the battery storage containers in Mitsinjo',
      'auto',
      metaModels
    );
    expect(r2.modality).toBe('image');
    expect(r2.targetModel).toBe('muse-image-1.0');

    const r3 = detectAdaptiveRoute('Dessine le schéma du village', 'auto', metaModels);
    expect(r3.modality).toBe('image');
    expect(r3.targetModel).toBe('muse-image-1.0');

    const r4 = detectAdaptiveRoute('Mamorona sary momba ny masoandro', 'auto', metaModels);
    expect(r4.modality).toBe('image');
    expect(r4.targetModel).toBe('muse-image-1.0');
  });

  it('routes deep reasoning requests to muse-wonder-1.0', () => {
    const r1 = detectAdaptiveRoute(
      'Fais une analyse approfondie des compromis de la stratégie prioritaire',
      'auto',
      metaModels
    );
    expect(r1.modality).toBe('reasoning');
    expect(r1.targetModel).toBe('muse-wonder-1.0');

    const r2 = detectAdaptiveRoute(
      'Provide a deep analysis of long-term battery degradation and social trade-offs',
      'auto',
      metaModels
    );
    expect(r2.modality).toBe('reasoning');
    expect(r2.targetModel).toBe('muse-wonder-1.0');
  });

  it('routes standard operational queries to muse-spark-1.3 with tools', () => {
    const r1 = detectAdaptiveRoute(
      'Pourquoi le centre de santé reçoit-il moins d’énergie ?',
      'auto',
      metaModels
    );
    expect(r1.modality).toBe('chat');
    expect(r1.targetModel).toBe('muse-spark-1.3');

    const r2 = detectAdaptiveRoute(
      'What happens if solar drops by 40 % for 2 hours?',
      'auto',
      metaModels
    );
    expect(r2.modality).toBe('chat');
    expect(r2.targetModel).toBe('muse-spark-1.3');
  });

  it('honors explicit user model selection regardless of prompt content', () => {
    const r1 = detectAdaptiveRoute('What is solar?', 'muse-image-1.0', metaModels);
    expect(r1.targetModel).toBe('muse-image-1.0');
    expect(r1.modality).toBe('image');

    const r2 = detectAdaptiveRoute('Draw a picture of panels', 'muse-spark-1.3', metaModels);
    expect(r2.targetModel).toBe('muse-spark-1.3');
    expect(r2.modality).toBe('chat');
  });

  it('keeps chart and diagram wording on the tool-calling chat model', () => {
    for (const q of ['Visualize the battery SoC over 24h', 'Montre le schéma du réseau']) {
      const r = detectAdaptiveRoute(q, 'auto', metaModels);
      expect(r.modality).toBe('chat');
      expect(r.targetModel).toBe('muse-spark-1.3');
    }
  });
});
