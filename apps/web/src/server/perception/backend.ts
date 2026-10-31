import type { UsageSample } from '@/server/spend';
import type { SegmentResult, TranscribeOptions, Transcript, VisionResult } from './schemas';

type WithoutSource<T> = Omit<T, 'source' | 'model' | 'fallback'>;

export interface PerceptionCall<T> {
  result: WithoutSource<T>;
  model: string;
  /** What the call cost, for the spend guard (empty for the mock). */
  usage: UsageSample;
}

/** One way to reach the perception models: the Meta API or the deterministic mock. */
export interface PerceptionBackend {
  readonly name: 'meta' | 'mock';
  /** `audio` must be WAV (mono PCM 16 or 24 kHz): the only format the Meta API accepts. */
  transcribe(
    audio: Blob,
    options?: TranscribeOptions,
    signal?: AbortSignal
  ): Promise<PerceptionCall<Transcript>>;
  /** `imageUrl`: https URL or `data:image/...;base64,...`. */
  analyzeImage(
    imageUrl: string,
    question: string,
    signal?: AbortSignal
  ): Promise<PerceptionCall<VisionResult>>;
  /** One concept per call (a short noun phrase, e.g. `solar panel`). */
  segmentImage(
    imageUrl: string,
    concept: string,
    signal?: AbortSignal
  ): Promise<PerceptionCall<SegmentResult>>;
}
