import type { ApplianceCategory } from '@mitsinjo/engine';
import type { SceneryType } from '@/lib/vision';
import type { UsageSample } from '@/server/spend';
import type {
  CriticResult,
  DetectionResult,
  SegmentResult,
  ShapeResult,
  TranscribeOptions,
  Transcript,
  VisionResult,
} from './schemas';

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
  /** Appliances visible on a photo (PV): labels, categories, boxes. One vision call. */
  detectAppliances(
    imageUrl: string,
    signal?: AbortSignal
  ): Promise<PerceptionCall<DetectionResult>>;
  /** The one object inside an operator-drawn shape (PV-T8): `imageUrl` is the crop, `hint` what they typed. */
  identifyRegion(
    imageUrl: string,
    hint: string | undefined,
    signal?: AbortSignal
  ): Promise<PerceptionCall<DetectionResult>>;
  /** 3D recipe of one object (PV-T9): `imageUrl` is the crop around it. One vision call. */
  describeShape(
    imageUrl: string,
    target: ShapeSubject,
    signal?: AbortSignal
  ): Promise<PerceptionCall<ShapeResult>>;
  /**
   * Visual critic (PR-0.6): `imageUrl` is crop | flat render side by side, `question` carries the
   * kit + scores. One vision call, partial-kit schema; null patch when the model matches.
   */
  criticizeShape(
    imageUrl: string,
    question: string,
    signal?: AbortSignal
  ): Promise<PerceptionCall<CriticResult>>;
}

/** What `describeShape` is told about the object. */
export interface ShapeSubject {
  label: string;
  category: ApplianceCategory;
  /** Set for scenery (no load): building, tree, vehicle… */
  scenery?: SceneryType;
  /** Width / height of the object on the photo, in pixels (thin pole ≈ 0.1, wide car ≈ 2). */
  aspect?: number;
}
