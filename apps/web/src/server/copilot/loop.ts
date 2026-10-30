import 'server-only';

import { simulate, type SimulationInput, type StrategyId } from '@mitsinjo/engine';
import { type LlmProvider, type ChatMessage, type LlmImageResult } from './provider';
import { MockLlmProvider } from './providers/mock';
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools';
import { getSystemPrompt } from './prompt';
import { detectAdaptiveRoute, pickChatModel } from './adaptive-router';
import { MODEL_TOOL_DEFINITIONS, MODEL_TOOL_NAMES, executeModelTool } from './model-tools';
import { describeVillageScene } from './village-scene';
import { getPerceptionClient, type PerceptionClient } from '@/server/perception';
import { spendGuard as sharedSpendGuard, estimateTokens, type SpendGuard } from '@/server/spend';

export type SseEventName =
  | 'activity'
  | 'delta'
  | 'evidence'
  | 'proposal'
  | 'error'
  | 'done'
  | 'image'
  | 'video'
  | 'chart'
  | 'model'
  | 'perception';

export type SseEmitter = (event: SseEventName, data: Record<string, unknown>) => void;

export interface CopilotLoopOptions {
  messages: {
    role: 'user' | 'assistant';
    content: string;
    media?: Array<{ type: 'image' | 'video'; url: string }>;
  }[];
  input: SimulationInput;
  strategy?: StrategyId;
  provider?: LlmProvider;
  emit: SseEmitter;
  signal?: AbortSignal;
  locale?: 'en' | 'fr' | 'mg';
  requestedModel?: string;
  availableModels?: string[];
  /** Spend cap key, usually the chat session id. */
  budgetKey?: string;
  /** Injectable for tests; defaults to the process-wide guard. */
  spendGuard?: SpendGuard;
  /** Injectable for tests; defaults to `getPerceptionClient(budgetKey)`. */
  perception?: Pick<PerceptionClient, 'segmentImage'>;
  /** Hour shown in the app (timeline / scale model), for "show the village now". Default 12. */
  hour?: number;
  /** Chat budget in ms (tests only); default 20 s. */
  chatBudgetMs?: number;
}

const SPEND_CAP_MESSAGE = 'AI budget cap reached — showing deterministic explanation.';

const MAX_TOOL_ROUNDS = 4;
/** Budget for the chat model's own thinking. Slow tools (image, SAM) run outside it. */
const TIMEOUT_MS = 20_000;
/** Own limit of one slow model tool (image ≈ 12–23 s, SAM ≈ 5 s measured). */
const MODEL_TOOL_TIMEOUT_MS = 45_000;
/** Extra chat budget after a switch to Wonder (slower answers). */
const WONDER_EXTRA_MS = 30_000;
/** Engine tools + model-switch tools (image, segmentation, deep reasoning). */
const ALL_TOOL_DEFINITIONS = [...TOOL_DEFINITIONS, ...MODEL_TOOL_DEFINITIONS];

function getToolActivityLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'get_grid_state':
      return 'Reading current scenario';
    case 'run_scenario':
      return 'Simulating scenario parameters';
    case 'compare_strategies':
      return 'Running comparison';
    case 'get_sector_metrics':
      return `Reviewing ${args.sector ?? ''} sector telemetry`;
    case 'propose_change':
      return 'Formulating scenario proposal';
    default:
      return 'Reviewing computed results';
  }
}

export async function runCopilotLoop(options: CopilotLoopOptions): Promise<void> {
  const {
    messages,
    input,
    strategy = 'proportional',
    emit,
    signal,
    locale = 'fr',
    requestedModel,
    availableModels = [],
    budgetKey = 'global',
    spendGuard = sharedSpendGuard,
    hour = 12,
    chatBudgetMs = TIMEOUT_MS,
  } = options;
  let activeProvider = options.provider || new MockLlmProvider();

  // Paid provider over its session budget → deterministic mock for the whole turn.
  const capReached = () => activeProvider.name !== 'mock' && !spendGuard.canSpend(budgetKey);
  const switchToMockForCap = () => {
    console.warn(`[copilot:loop] Spend cap reached for "${budgetKey}", using MockLlmProvider.`);
    emit('error', { code: 'PROVIDER_FALLBACK', reason: 'spend_cap', message: SPEND_CAP_MESSAGE });
    activeProvider = new MockLlmProvider();
  };

  // Find user prompt for adaptive routing
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userQuery = lastUserMsg?.content || '';
  const attachedImage = lastUserMsg?.media?.find((m) => m.type === 'image')?.url;

  const route = detectAdaptiveRoute(requestedModel, availableModels, {
    hasImage: Boolean(attachedImage),
  });
  console.info(
    `[copilot:loop] Adaptive route selected: model="${route.targetModel}", modality="${route.modality}" (${route.reason})`
  );

  emit('model', {
    model: route.targetModel,
    modality: route.modality,
    reason: route.reason,
  });

  // Chat budget: a deadline that slow tools pause and a Wonder switch extends.
  const timeoutController = new AbortController();
  let deadline = Date.now() + chatBudgetMs;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const armBudget = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(
      () => timeoutController.abort(new Error('Copilot loop exceeded its time budget')),
      Math.max(0, deadline - Date.now())
    );
  };
  armBudget();
  /** Runs a slow tool with its own time limit; the chat budget is paused meanwhile. */
  const outsideBudget = async <T>(run: (toolSignal: AbortSignal) => Promise<T>): Promise<T> => {
    clearTimeout(timeoutId);
    const started = Date.now();
    const toolSignal = AbortSignal.any(
      [AbortSignal.timeout(MODEL_TOOL_TIMEOUT_MS), signal].filter((sig): sig is AbortSignal =>
        Boolean(sig)
      )
    );
    try {
      return await run(toolSignal);
    } finally {
      deadline += Date.now() - started;
      armBudget();
    }
  };

  // Combine caller signal and timeout
  const abortListener = () => timeoutController.abort(signal?.reason);
  if (signal) {
    signal.addEventListener('abort', abortListener, { once: true });
  }

  try {
    // ── IMAGE MODALITY BRANCH ─────────────────────────────
    if (route.modality === 'image') {
      emit('activity', {
        tool: 'generate_image',
        label:
          locale === 'fr'
            ? `Génération visuelle avec ${route.targetModel}...`
            : `Generating visual with ${route.targetModel}...`,
      });

      let imgResult: LlmImageResult | null = null;
      if (capReached()) switchToMockForCap();
      if (typeof activeProvider.generateImage === 'function') {
        try {
          const provider = activeProvider;
          imgResult = await outsideBudget((toolSignal) =>
            provider.generateImage!(userQuery, toolSignal)
          );
          if (activeProvider.name !== 'mock') {
            spendGuard.record(budgetKey, route.targetModel, { images: 1 });
          }
        } catch (err) {
          // Image model down → answer with the text copilot instead of failing the turn.
          console.warn('[copilot:loop] Image generation failed, falling back to chat:', err);
          emit('error', {
            code: 'PROVIDER_FALLBACK',
            message: 'AI provider unavailable — showing deterministic explanation.',
          });
        }
      }
      if (imgResult) {
        emit('image', {
          imageUrl: imgResult.imageUrl,
          caption: imgResult.caption || userQuery,
        });

        const imageDesc =
          locale === 'fr'
            ? `### Ce qui s'est passé\nVisuel synthétique du micro-réseau généré avec succès par Meta ${route.targetModel}.\n\n### Preuves calculées\nModèle : ${route.targetModel}\nType : Visualisation architecturale simulée.\n\n### Pourquoi c'est important\nPermet aux parties prenantes et villageois de se représenter concrètement l'implantation des panneaux et du stockage.\n\n### Et ensuite\nSouhaitez-vous inspecter la télémétrie des charges ou lancer une simulation de chute solaire ?`
            : `### What happened\nSynthetic microgrid visual generated successfully using Meta ${route.targetModel}.\n\n### Computed evidence\nModel: ${route.targetModel}\nType: Simulated architectural visualization.\n\n### Why it matters\nHelps operators and community members clearly visualize solar panel and battery layouts.\n\n### Explore next\nWould you like to review load telemetry or simulate a 40% solar drop?`;

        emit('delta', { text: imageDesc });
        emit('done', {});
        return;
      }
    }

    // ── REASONING / CHAT / VISION MODALITY BRANCH ──────────
    emit('activity', { tool: 'start', label: 'Reading microgrid simulation state...' });

    // Update active model on provider if supported
    // An image route that reached this point has no image result: chat with the default model.
    let chatModel = route.modality === 'image' ? pickChatModel(availableModels) : route.targetModel;
    if ('setModel' in activeProvider && typeof activeProvider.setModel === 'function') {
      activeProvider.setModel(chatModel);
    }
    const perception = options.perception ?? getPerceptionClient(budgetKey);

    // Build context
    const toolCtx: ToolContext = {
      input,
      activeStrategy: strategy,
    };

    // Prepare message history: localized SYSTEM_PROMPT + last 8 messages
    const systemPromptContent = getSystemPrompt(locale);
    const trimmedInputMessages = messages.slice(-8);
    const chatHistory: ChatMessage[] = [
      { role: 'system', content: systemPromptContent },
      ...trimmedInputMessages.map((m) => ({
        role: m.role,
        content: m.content,
        media: m.media,
      })),
    ];

    let rounds = 0;
    let completed = false;

    while (rounds < MAX_TOOL_ROUNDS && !completed) {
      if (timeoutController.signal.aborted) {
        console.error(`[copilot:loop] Loop timed out after ${TIMEOUT_MS}ms budget`);
        throw new Error('Copilot loop timed out');
      }
      rounds++;
      console.info(
        `[copilot:loop] Round ${rounds}/${MAX_TOOL_ROUNDS} — requesting turn from "${activeProvider.name}"...`
      );

      if (capReached()) switchToMockForCap();

      let turn;
      try {
        turn = await activeProvider.chat(
          chatHistory,
          ALL_TOOL_DEFINITIONS,
          timeoutController.signal
        );
        if (activeProvider.name !== 'mock') {
          // No usage from the API → estimate from text length (prompt + answer).
          const billed = activeProvider as LlmProvider & { getModel?: () => string };
          spendGuard.record(
            budgetKey,
            typeof billed.getModel === 'function' ? billed.getModel() : chatModel,
            turn.usage ?? {
              inputTokens: estimateTokens(JSON.stringify(chatHistory)),
              outputTokens: estimateTokens(JSON.stringify(turn)),
            }
          );
        }
      } catch (err) {
        // Fall back to MockLlmProvider on provider failure/timeout
        if (activeProvider.name !== 'mock') {
          console.warn(
            `[copilot:loop] Provider "${activeProvider.name}" failed: ${err instanceof Error ? err.message : err}. Falling back to MockLlmProvider.`
          );
          emit('error', {
            code: 'PROVIDER_FALLBACK',
            message: 'AI provider unavailable — showing deterministic explanation.',
          });
          activeProvider = new MockLlmProvider();
          turn = await activeProvider.chat(
            chatHistory,
            ALL_TOOL_DEFINITIONS,
            timeoutController.signal
          );
        } else {
          console.error('[copilot:loop] Mock provider failed:', err);
          throw err;
        }
      }

      // If the turn emitted tool calls
      if (turn.toolCalls && turn.toolCalls.length > 0) {
        // Record assistant's tool calls in history
        chatHistory.push({
          role: 'assistant',
          content: turn.content ?? null,
          toolCalls: turn.toolCalls,
        });

        for (const tc of turn.toolCalls) {
          console.info(
            `[copilot:loop] Executing tool "${tc.name}" with args:`,
            JSON.stringify(tc.args)
          );
          // `label` is for logs; the UI translates from `tool` (+ `sector`).
          emit('activity', {
            tool: tc.name,
            sector: typeof tc.args.sector === 'string' ? tc.args.sector : undefined,
            label: getToolActivityLabel(tc.name, tc.args),
          });

          if (MODEL_TOOL_NAMES.has(tc.name)) {
            const provider = activeProvider;
            const content = await outsideBudget((toolSignal) =>
              executeModelTool(tc.name, tc.args, {
                provider,
                perception,
                attachedImage,
                villageScene: () => describeVillageScene(input, simulate(input, strategy), hour),
                locale,
                availableModels,
                currentModel: chatModel,
                emit,
                signal: toolSignal,
                canSpend: () => spendGuard.canSpend(budgetKey),
                recordSpend: (model, usage) => spendGuard.record(budgetKey, model, usage),
                switchModel: (model) => {
                  const p = activeProvider as LlmProvider & { setModel?: (m: string) => void };
                  if (p.name === 'mock' || typeof p.setModel !== 'function') return false;
                  p.setModel(model);
                  chatModel = model;
                  deadline += WONDER_EXTRA_MS;
                  return true;
                },
              })
            );
            chatHistory.push({
              role: 'tool',
              name: tc.name,
              toolCallId: tc.id,
              content: JSON.stringify(content),
            });
            continue;
          }

          const toolResult = executeTool(tc.name, tc.args, toolCtx);
          console.info(
            `[copilot:loop] Tool "${tc.name}" execution complete (resultId: ${toolResult.resultId || 'none'})`
          );

          if (toolResult.evidence) {
            emit('evidence', {
              resultId: toolResult.resultId || 'SIM-BASELINE',
              fields: toolResult.evidence,
            });
          }

          if (toolResult.proposal) {
            emit('proposal', toolResult.proposal);
          }

          // Return tool result to history
          chatHistory.push({
            role: 'tool',
            name: tc.name,
            toolCallId: tc.id,
            content: JSON.stringify(
              toolResult.error ? { error: toolResult.error } : toolResult.data || {}
            ),
          });
        }
      } else if (turn.content) {
        // Final text answer reached
        console.info(
          `[copilot:loop] Round ${rounds}: Final text answer received (${turn.content.length} chars). Streaming to client...`
        );
        completed = true;
        chatHistory.push({
          role: 'assistant',
          content: turn.content,
        });

        // Stream delta text in realistic sentence chunks
        const chunks = turn.content.split(/(?<=\n\n)/);
        for (const chunk of chunks) {
          if (chunk.length > 0) {
            emit('delta', { text: chunk });
          }
        }
      } else {
        // Empty turn
        console.warn(`[copilot:loop] Round ${rounds}: Turn returned with empty content.`);
        completed = true;
      }
    }

    console.info(`[copilot:loop] Loop finished successfully after ${rounds} round(s).`);
    emit('done', {});
  } catch (err) {
    console.error('[copilot:loop] Unhandled error during copilot execution:', err);
    emit('error', {
      code: 'LOOP_ERROR',
      message: err instanceof Error ? err.message : 'Unknown copilot error',
    });
    emit('done', {});
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', abortListener);
    }
  }
}
