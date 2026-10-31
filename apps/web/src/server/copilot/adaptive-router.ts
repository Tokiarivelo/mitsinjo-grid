import 'server-only';

/**
 * chat = Spark + tools · reasoning = Wonder + tools · vision = Spark + tools reading an attached image ·
 * image = Muse Image only (explicit selection).
 */
export type CopilotModality = 'image' | 'reasoning' | 'chat' | 'vision';

export interface RouteDecision {
  targetModel: string;
  modality: CopilotModality;
  reason: string;
}

export interface RouteContext {
  /** The latest user message carries an image (photo, sketch). */
  hasImage?: boolean;
}

export const DEFAULT_CHAT_MODEL = 'muse-spark-1.3';
export const WONDER_MODEL = 'muse-wonder-1.0';
export const IMAGE_MODEL = 'muse-image-1.0';

/** Best Spark model the account exposes (Spark 1.3 reads images natively). */
export function pickChatModel(availableModels: string[] = []): string {
  return (
    availableModels.find((m) => m === DEFAULT_CHAT_MODEL) ||
    availableModels.find((m) => m.startsWith('muse-spark-') && !m.endsWith('-contributor')) ||
    DEFAULT_CHAT_MODEL
  );
}

/**
 * Starting model for a turn, from structure only (explicit choice, attached image). The wording is never
 * parsed here: Spark reads the request and switches model itself through tool calls
 * (`generate_image` → Muse Image, `segment_image` → SAM, `escalate_deep_reasoning` → Wonder).
 */
export function detectAdaptiveRoute(
  requestedModel?: string,
  availableModels: string[] = [],
  context: RouteContext = {}
): RouteDecision {
  const normalizedModel = (requestedModel || 'auto').trim();

  if (normalizedModel !== 'auto' && normalizedModel !== '') {
    if (normalizedModel === IMAGE_MODEL) {
      return {
        targetModel: IMAGE_MODEL,
        modality: 'image',
        reason: `User explicitly selected ${IMAGE_MODEL}`,
      };
    }
    if (normalizedModel === WONDER_MODEL) {
      return {
        targetModel: WONDER_MODEL,
        modality: 'reasoning',
        reason: `User explicitly selected ${WONDER_MODEL}`,
      };
    }
    return {
      targetModel: normalizedModel,
      modality: context.hasImage ? 'vision' : 'chat',
      reason: `User explicitly selected ${normalizedModel}`,
    };
  }

  const chatModel = pickChatModel(availableModels);
  if (context.hasImage) {
    return {
      targetModel: chatModel,
      modality: 'vision',
      reason: 'Attached image: vision-capable chat model with tools',
    };
  }
  return {
    targetModel: chatModel,
    modality: 'chat',
    reason: 'Chat model with tools; it switches model through tool calls when needed',
  };
}
