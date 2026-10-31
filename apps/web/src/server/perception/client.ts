import 'server-only';

import { env } from '@/lib/env';
import { spendGuard, type SpendGuard } from '@/server/spend';
import type { PerceptionBackend, PerceptionCall } from './backend';
import { MetaPerceptionBackend } from './meta';
import { MockPerceptionBackend } from './mock';
import type {
  DetectionResult,
  PerceptionSource,
  SegmentResult,
  TranscribeOptions,
  Transcript,
  VisionResult,
} from './schemas';

/**
 * Perception entry point for routes and copilot tools. Never throws for a Meta problem:
 * missing key, spend cap or API error → the deterministic mock answers, with `fallback` set.
 */
export class PerceptionClient {
  constructor(
    private readonly primary: PerceptionBackend | null,
    private readonly mock: PerceptionBackend,
    private readonly guard: SpendGuard,
    private readonly budgetKey: string,
    /** Set when Meta was asked for but has no key (shown as a fallback, not as plain mock mode). */
    private readonly notConfigured = false
  ) {}

  /** True when calls go to Meta (worth hosting the photo); false in mock mode. */
  get callsMeta(): boolean {
    return this.primary !== null;
  }

  private async run<T>(
    kind: string,
    call: (b: PerceptionBackend) => Promise<PerceptionCall<T>>
  ): Promise<T & PerceptionSource> {
    const fromMock = async (fallback?: PerceptionSource['fallback']) => {
      const out = await call(this.mock);
      return {
        ...out.result,
        source: 'mock',
        model: out.model,
        ...(fallback ? { fallback } : {}),
      } as T & PerceptionSource;
    };

    if (!this.primary) return fromMock(this.notConfigured ? 'not_configured' : undefined);
    if (!this.guard.canSpend(this.budgetKey)) {
      console.warn(`[perception] ${kind}: spend cap reached for "${this.budgetKey}", using mock`);
      return fromMock('spend_cap');
    }
    try {
      const out = await call(this.primary);
      this.guard.record(this.budgetKey, out.model, out.usage);
      return { ...out.result, source: 'meta', model: out.model } as T & PerceptionSource;
    } catch (err) {
      console.warn(
        `[perception] ${kind} failed on Meta, using mock:`,
        err instanceof Error ? err.message : err
      );
      return fromMock('provider_error');
    }
  }

  transcribe(audio: Blob, options?: TranscribeOptions, signal?: AbortSignal): Promise<Transcript> {
    return this.run('transcribe', (b) => b.transcribe(audio, options, signal));
  }

  analyzeImage(imageUrl: string, question: string, signal?: AbortSignal): Promise<VisionResult> {
    return this.run('analyzeImage', (b) => b.analyzeImage(imageUrl, question, signal));
  }

  segmentImage(imageUrl: string, concept: string, signal?: AbortSignal): Promise<SegmentResult> {
    return this.run('segmentImage', (b) => b.segmentImage(imageUrl, concept, signal));
  }

  detectAppliances(imageUrl: string, signal?: AbortSignal): Promise<DetectionResult> {
    return this.run('detectAppliances', (b) => b.detectAppliances(imageUrl, signal));
  }
}

/** Client for one chat session (`budgetKey` = session id): Meta when configured, else mock. */
export function getPerceptionClient(budgetKey = 'global'): PerceptionClient {
  const wantsMeta = env.LLM_PROVIDER === 'meta';
  const hasKey = Boolean(env.META_API_KEY);
  return new PerceptionClient(
    wantsMeta && hasKey ? new MetaPerceptionBackend() : null,
    new MockPerceptionBackend(),
    spendGuard,
    budgetKey,
    wantsMeta && !hasKey
  );
}
