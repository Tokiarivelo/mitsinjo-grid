import { describe, expect, it, vi } from 'vitest';
import { SpendGuard } from '@/server/spend';
import { MockPerceptionBackend, PerceptionClient } from '@/server/perception';
import { executeModelTool, stripNumbers, type ModelToolContext } from '../model-tools';

function makeCtx(overrides: Partial<ModelToolContext> = {}) {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  const ctx: ModelToolContext = {
    provider: {
      name: 'meta',
      chat: vi.fn(),
      generateImage: vi.fn().mockResolvedValue({ imageUrl: 'data:image/webp;base64,AA' }),
    },
    perception: new PerceptionClient(null, new MockPerceptionBackend(), new SpendGuard(1), 's'),
    availableModels: ['muse-spark-1.3', 'muse-wonder-1.0', 'muse-image-1.0', 'sam-3.1'],
    currentModel: 'muse-spark-1.3',
    emit: (event, data) => events.push({ event, data }),
    canSpend: () => true,
    recordSpend: vi.fn(),
    switchModel: vi.fn().mockReturnValue(true),
    ...overrides,
  };
  return { ctx, events };
}

describe('generate_image', () => {
  it('draws with the image model, emits the image and records the cost', async () => {
    const { ctx, events } = makeCtx();
    const out = await executeModelTool(
      'generate_image',
      {
        prompt: 'Village at night with 12 lamps and 40 kW of solar',
        caption: 'Le village ce soir',
      },
      ctx
    );
    expect(out).toMatchObject({ ok: true, model: 'muse-image-1.0', caption: 'Le village ce soir' });
    expect(ctx.provider.generateImage).toHaveBeenCalledWith(
      'Village at night with lamps and of solar',
      undefined
    );
    expect(events).toEqual([
      {
        event: 'image',
        data: { imageUrl: 'data:image/webp;base64,AA', caption: 'Le village ce soir' },
      },
    ]);
    expect(ctx.recordSpend).toHaveBeenCalledWith('muse-image-1.0', { images: 1 });
  });

  it('returns an error to the model instead of throwing', async () => {
    const { ctx } = makeCtx({
      provider: {
        name: 'meta',
        chat: vi.fn(),
        generateImage: vi.fn().mockRejectedValue(new Error('500')),
      },
    });
    expect(await executeModelTool('generate_image', { prompt: 'a village' }, ctx)).toHaveProperty(
      'error'
    );
    expect(await executeModelTool('generate_image', { prompt: '' }, ctx)).toHaveProperty('error');
  });

  it('refuses a paid image once the spend cap is reached', async () => {
    const { ctx } = makeCtx({ canSpend: () => false });
    const out = await executeModelTool('generate_image', { prompt: 'a village' }, ctx);
    expect(out.error).toMatch(/budget/);
    expect(ctx.provider.generateImage).not.toHaveBeenCalled();
  });
});

describe('generate_image with the current village scene', () => {
  const scene = {
    hour: 20,
    sky: 'night' as const,
    battery: 'low' as const,
    sectors: { health: 'lit' as const, market: 'dark' as const },
    prompt: 'Village at night; the market stalls without power, completely dark. No numbers.',
  };

  it('uses the engine-built prompt and caption, and tells the model what is shown', async () => {
    const { ctx, events } = makeCtx({ villageScene: () => scene, locale: 'fr' });
    const out = await executeModelTool(
      'generate_image',
      { scene: 'current_village', prompt: 'ignored 40 kW' },
      ctx
    );
    expect(ctx.provider.generateImage).toHaveBeenCalledWith(scene.prompt, undefined);
    expect(out.shownState).toEqual({
      hour: 20,
      sky: 'night',
      battery: 'low',
      sectors: { health: 'lit', market: 'dark' },
    });
    expect(String(events[0]?.data.caption)).toContain('à 20 h');
    expect(String(events[0]?.data.caption)).toContain('marché : coupé');
  });

  it('returns an error when the state is not available', async () => {
    const { ctx } = makeCtx();
    expect(
      (await executeModelTool('generate_image', { scene: 'current_village' }, ctx)).error
    ).toBeDefined();
  });

  it('requires a prompt for a custom scene', async () => {
    const { ctx } = makeCtx();
    expect((await executeModelTool('generate_image', { scene: 'custom' }, ctx)).error).toMatch(
      /prompt/
    );
  });
});

describe('segment_image', () => {
  it('segments the attached photo and labels the result as AI perception', async () => {
    const { ctx, events } = makeCtx({ attachedImage: 'data:image/png;base64,AA' });
    const out = await executeModelTool('segment_image', { concept: 'roof' }, ctx);
    expect(out).toMatchObject({ concept: 'roof', count: 2, boxCoverage: 0.29, source: 'mock' });
    expect(String(out.note)).toMatch(/not an engine value/i);
    expect(events[0]).toMatchObject({ event: 'perception', data: { kind: 'segment', count: 2 } });
  });

  it('asks for a photo when none is attached', async () => {
    const { ctx } = makeCtx();
    expect((await executeModelTool('segment_image', { concept: 'roof' }, ctx)).error).toMatch(
      /No photo/
    );
  });
});

describe('escalate_deep_reasoning', () => {
  it('switches to Wonder and announces the new model', async () => {
    const { ctx, events } = makeCtx();
    const out = await executeModelTool(
      'escalate_deep_reasoning',
      { reason: 'Plan for 7 days' },
      ctx
    );
    expect(out).toEqual({ ok: true, model: 'muse-wonder-1.0' });
    expect(ctx.switchModel).toHaveBeenCalledWith('muse-wonder-1.0');
    expect(events[0]).toMatchObject({ event: 'model', data: { modality: 'reasoning' } });
  });

  it('stays on the current model when Wonder is not available', async () => {
    const { ctx } = makeCtx({ availableModels: ['muse-spark-1.3'] });
    expect(
      (await executeModelTool('escalate_deep_reasoning', { reason: 'audit' }, ctx)).error
    ).toBeDefined();
    expect(ctx.switchModel).not.toHaveBeenCalled();
  });
});

describe('stripNumbers', () => {
  it('removes numbers and energy units from an image prompt', () => {
    expect(stripNumbers('Battery at 45 % and 12,5 kWh, 3 houses')).toBe('Battery at and , houses');
  });
});
