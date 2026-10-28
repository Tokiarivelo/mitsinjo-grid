import 'server-only';

export type CopilotModality = 'image' | 'reasoning' | 'chat';

export interface RouteDecision {
  targetModel: string;
  modality: CopilotModality;
  reason: string;
}

const IMAGE_REGEX =
  /\b(image|picture|photo|illustration|dessin|dessine|dessiner|schéma|schema|visualise|visualiser|visualize|generate an? image|crée une image|génère une image|générer une image|sary|mamorona sary)\b/i;

const DEEP_REASONING_REGEX =
  /\b(wonder|deep analysis|analyse approfondie|en profondeur|audit complet|planifi|long-term|long terme|famakafakana lalina|compromis complexe)\b/i;

/**
 * Automatically inspects the user's latest query to route to the optimal model and modality.
 * If user explicitly requested a specific model (not 'auto'), that model is honored.
 */
export function detectAdaptiveRoute(
  query: string,
  requestedModel?: string,
  availableModels: string[] = []
): RouteDecision {
  const normalizedModel = (requestedModel || 'auto').trim();

  // Explicit user override
  if (normalizedModel !== 'auto' && normalizedModel !== '') {
    if (normalizedModel === 'muse-image-1.0') {
      return {
        targetModel: 'muse-image-1.0',
        modality: 'image',
        reason: 'User explicitly selected muse-image-1.0',
      };
    }
    if (normalizedModel === 'muse-wonder-1.0') {
      return {
        targetModel: 'muse-wonder-1.0',
        modality: 'reasoning',
        reason: 'User explicitly selected muse-wonder-1.0',
      };
    }
    return {
      targetModel: normalizedModel,
      modality: 'chat',
      reason: `User explicitly selected ${normalizedModel}`,
    };
  }

  // 1. Detect Image Generation request
  if (IMAGE_REGEX.test(query)) {
    const hasImageModel = availableModels.includes('muse-image-1.0');
    return {
      targetModel: hasImageModel ? 'muse-image-1.0' : 'mock-image',
      modality: 'image',
      reason: 'Auto-detected image generation request from prompt',
    };
  }

  // 2. Detect Deep Reasoning (Wonder) request
  if (DEEP_REASONING_REGEX.test(query) && availableModels.includes('muse-wonder-1.0')) {
    return {
      targetModel: 'muse-wonder-1.0',
      modality: 'reasoning',
      reason: 'Auto-detected deep reasoning request from prompt',
    };
  }

  // 3. Standard Microgrid Copilot + Simulation Tools (Muse Spark)
  const defaultSpark =
    availableModels.find((m) => m === 'muse-spark-1.3') ||
    availableModels.find((m) => m.startsWith('muse-spark-')) ||
    'muse-spark-1.3';

  return {
    targetModel: defaultSpark,
    modality: 'chat',
    reason: 'Standard microgrid operational advisory with tool calling',
  };
}
