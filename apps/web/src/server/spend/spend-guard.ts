import 'server-only';

/**
 * Estimated Meta spend per budget key (chat session id, or `global`), checked before each paid call.
 * Prices come from the Meta Model API catalogue (USD). In-memory: resets on server restart, which is fine
 * for a demo cap. Unknown models count as the most expensive chat model so the cap stays safe.
 */

export interface UsageSample {
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  audioMs?: number;
  videoFrames?: number;
}

interface Price {
  inputPerMTok?: number;
  outputPerMTok?: number;
  perImage?: number;
  perAudioHour?: number;
  perVideoFrame?: number;
}

const PRICES: Record<string, Price> = {
  'muse-wonder-1.0': { inputPerMTok: 4, outputPerMTok: 20 },
  'muse-spark-1.3': { inputPerMTok: 1.25, outputPerMTok: 4.25 },
  'muse-spark-1.2': { inputPerMTok: 1.25, outputPerMTok: 4.25 },
  'muse-spark-1.1': { inputPerMTok: 1.25, outputPerMTok: 4.25 },
  'muse-spark-1.3-contributor': { inputPerMTok: 0.1, outputPerMTok: 0.2 },
  'muse-spark-1.2-contributor': { inputPerMTok: 0.1, outputPerMTok: 0.2 },
  'muse-image-1.0': { perImage: 0.01 },
  'sam-3.1': { perImage: 0.0025, perVideoFrame: 0.0002 },
  'muse-voice-transcribe-1.0': { perAudioHour: 0.18 },
};

const FALLBACK_PRICE: Price = PRICES['muse-wonder-1.0']!;

/** Estimated cost in USD of one call. */
export function estimateCostUsd(model: string, usage: UsageSample): number {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  return (
    ((usage.inputTokens ?? 0) * (p.inputPerMTok ?? 0)) / 1e6 +
    ((usage.outputTokens ?? 0) * (p.outputPerMTok ?? 0)) / 1e6 +
    (usage.images ?? 0) * (p.perImage ?? 0) +
    ((usage.audioMs ?? 0) / 3_600_000) * (p.perAudioHour ?? 0) +
    (usage.videoFrames ?? 0) * (p.perVideoFrame ?? 0)
  );
}

/** Rough token count when the API returns no usage (≈ 4 characters per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class SpendGuard {
  private readonly spent = new Map<string, number>();

  constructor(private readonly capUsd: number) {}

  /** True while the key is under the cap. A cap of 0 blocks every paid call. */
  canSpend(key = 'global'): boolean {
    return this.spentUsd(key) < this.capUsd;
  }

  record(key: string, model: string, usage: UsageSample): number {
    const cost = estimateCostUsd(model, usage);
    this.spent.set(key, this.spentUsd(key) + cost);
    return cost;
  }

  spentUsd(key = 'global'): number {
    return this.spent.get(key) ?? 0;
  }
}
