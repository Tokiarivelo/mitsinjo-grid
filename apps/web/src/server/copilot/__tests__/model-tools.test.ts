import { describe, expect, it, vi } from 'vitest';
import { scenarios, simulate } from '@mitsinjo/engine';
import { SpendGuard } from '@/server/spend';
import { MockPerceptionBackend, PerceptionClient } from '@/server/perception';
import { executeModelTool, stripNumbers, type ModelToolContext } from '../model-tools';
import { rememberResult } from '../result-cache';

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

describe('generate_visual (M5-T1)', () => {
  it('unknown resultId → error naming the result, no image call', async () => {
    const { ctx } = makeCtx();
    const out = await executeModelTool(
      'generate_visual',
      { kind: 'shedding_poster', resultId: 'SIM-NOPE' },
      ctx
    );
    expect(out.error).toMatch(/resultId|scenario/i);
    expect(ctx.provider.generateImage).not.toHaveBeenCalled();
  });

  it('builds the prompt from the cached engine result and emits media', async () => {
    const input = scenarios.cloudy_afternoon.input;
    const result = simulate(input, 'proportional');
    rememberResult(input, result);
    const { ctx, events } = makeCtx();
    const out = await executeModelTool(
      'generate_visual',
      { kind: 'shedding_poster', resultId: result.id },
      ctx
    );
    expect(out).toMatchObject({ ok: true, kind: 'shedding_poster', resultId: result.id });
    expect(out.overlay).toBeDefined();
    expect(ctx.provider.generateImage).toHaveBeenCalledWith(
      expect.not.stringMatching(/\d/),
      undefined
    );
    expect(events).toEqual([
      {
        event: 'media',
        data: {
          kind: 'shedding_poster',
          imageUrl: 'data:image/webp;base64,AA',
          caption: out.caption,
          overlay: out.overlay,
          resultId: result.id,
        },
      },
    ]);
    expect(ctx.recordSpend).toHaveBeenCalledWith('muse-image-1.0', { images: 1 });
  });

  it('rejects an unknown kind without calling the image model', async () => {
    const { ctx } = makeCtx();
    const out = await executeModelTool(
      'generate_visual',
      { kind: 'movie_trailer', resultId: 'SIM-NOPE' },
      ctx
    );
    expect(out).toHaveProperty('error');
    expect(ctx.provider.generateImage).not.toHaveBeenCalled();
  });
});

describe('convene_council (M7-T1)', () => {
  const councilState = () => ({
    input: scenarios.cloudy_afternoon.input,
    strategy: 'proportional' as const,
  });

  it('mock provider: personas only, council event with engine-simulated voices', async () => {
    const { ctx, events } = makeCtx({
      provider: { name: 'mock', chat: vi.fn() },
      councilState,
    });
    const out = await executeModelTool(
      'convene_council',
      { question: 'Who should shed load tonight?' },
      ctx
    );
    expect(ctx.provider.chat).not.toHaveBeenCalled();
    expect(out).toMatchObject({ ok: true, rounds: 1 });
    expect(out.agents).toHaveLength(5);
    const council = events.find((e) => e.event === 'council');
    expect(council?.data.verdict).toMatchObject({ mock: true });
    expect((council?.data.agents as { sector: string }[]).map((a) => a.sector)).toEqual([
      'health',
      'water',
      'school',
      'households',
      'market',
    ]);
  });

  it('asks for a real question', async () => {
    const { ctx } = makeCtx({ councilState });
    expect(await executeModelTool('convene_council', { question: 'x' }, ctx)).toHaveProperty(
      'error'
    );
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

describe('analyze_image (M4-T2)', () => {
  it('reads the attached photo as validated observations and emits them', async () => {
    const { ctx, events } = makeCtx({ attachedImage: 'data:image/png;base64,AA' });
    const out = await executeModelTool(
      'analyze_image',
      { question: 'What does the meter read on this photo?' },
      ctx
    );
    expect(out).toMatchObject({
      observations: [{ label: 'meter_reading', value: 1284, unit: 'kWh', confidence: 0.5 }],
      source: 'mock',
    });
    expect(String(out.note)).toMatch(/not an engine value/i);
    expect(events[0]).toMatchObject({ event: 'perception', data: { kind: 'analyze' } });
  });

  it('asks for a photo when none is attached', async () => {
    const { ctx } = makeCtx();
    expect(
      (await executeModelTool('analyze_image', { question: 'What do you see?' }, ctx)).error
    ).toMatch(/No photo/);
  });

  it('rejects invalid args and invalid backend observations without throwing', async () => {
    const { ctx } = makeCtx({ attachedImage: 'data:image/png;base64,AA' });
    expect((await executeModelTool('analyze_image', {}, ctx)).error).toMatch(/Invalid arguments/);
    const { ctx: badCtx } = makeCtx({
      attachedImage: 'data:image/png;base64,AA',
      perception: {
        analyzeImage: async () => ({
          model: 'mock',
          usage: {},
          result: {
            summary: 'garbage',
            observations: [{ label: '', value: 1, confidence: 5 }],
          },
        }),
      } as never,
    });
    expect(
      (await executeModelTool('analyze_image', { question: 'What do you see?' }, badCtx)).error
    ).toMatch(/observations/);
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
