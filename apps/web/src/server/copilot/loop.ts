import 'server-only';

import { simulate, type SimulationInput, type StrategyId } from '@mitsinjo/engine';
import { type LlmProvider, type ChatMessage, type LlmImageResult } from './provider';
import { MockLlmProvider } from './providers/mock';
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools';
import { appHourNote, RETRY_NOTE, getSystemPrompt } from './prompt';
import { detectAdaptiveRoute, pickChatModel } from './adaptive-router';
import { MODEL_TOOL_DEFINITIONS, MODEL_TOOL_NAMES, executeModelTool } from './model-tools';
import { describeVillageScene } from './village-scene';
import { getPerceptionClient, type PerceptionClient } from '@/server/perception';
import { spendGuard as sharedSpendGuard, estimateTokens, type SpendGuard } from '@/server/spend';
import { compactHistory } from './history';
import { planCompaction, summarizeTurns, summaryNote } from './compaction';
import { COPILOT_HISTORY_LIMIT } from '@/features/copilot/utils/history';

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
  | 'perception'
  | 'summary'
  | 'control';

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
  /** Hour shown in the app (timeline / scale model): "now" for caps (K2) and the village image. Default 12. */
  hour?: number;
  /** Chat budget in ms (tests only); default 40 s. */
  chatBudgetMs?: number;
  /** The operator asked to redo the last answer (Retry): the model is told it did not help. */
  retry?: boolean;
  /** Summary of the turns before `messages` (auto-compaction). */
  summary?: string;
  /** How many payload messages come before `messages` (covered by `summary` or dropped). */
  summarizedCount?: number;
}

const SPEND_CAP_MESSAGE = 'AI budget cap reached — showing deterministic explanation.';

const MAX_TOOL_ROUNDS = 4;
/** Budget for the chat model's own thinking (all rounds). Slow tools (image, SAM) run outside it. */
const TIMEOUT_MS = 40_000;
/** Own limit of one slow model tool (image ≈ 12–23 s, SAM ≈ 5 s measured). */
const MODEL_TOOL_TIMEOUT_MS = 45_000;
/** Extra chat budget after a switch to Wonder (slower answers). */
const WONDER_EXTRA_MS = 30_000;
/** Engine tools + model-switch tools (image, segmentation, deep reasoning). */
const ALL_TOOL_DEFINITIONS = [...TOOL_DEFINITIONS, ...MODEL_TOOL_DEFINITIONS];

/** Errors worth one retry before falling back: rate limit, server error, network failure. */
export function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof Error) || err.name === 'AbortError') return false;
  return err.name === 'TypeError' || /\((429|5\d\d)\)/.test(err.message);
}

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
    case 'control_playback':
      return 'Controlling playback';
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
    summarizedCount = 0,
  } = options;
  let summary = options.summary;
  // Offline copilot answers in the app language (not guessed from the question).
  const offline = () => new MockLlmProvider({ locale: options.locale });
  let activeProvider = options.provider || offline();

  // Paid provider over its session budget → deterministic mock for the whole turn.
  const capReached = () => activeProvider.name !== 'mock' && !spendGuard.canSpend(budgetKey);
  const switchToMockForCap = () => {
    console.warn(`[copilot:loop] Spend cap reached for "${budgetKey}", using MockLlmProvider.`);
    emit('error', { code: 'PROVIDER_FALLBACK', reason: 'spend_cap', message: SPEND_CAP_MESSAGE });
    activeProvider = offline();
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
            reason: 'provider_error',
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

    // Auto-compaction: history over the token limit → fold older turns into the summary.
    let history = messages;
    const plan = planCompaction(messages);
    if (plan) {
      emit('activity', { tool: 'compact_history', label: 'Summarizing earlier conversation...' });
      try {
        if (capReached()) throw new Error('spend cap reached');
        const provider = activeProvider;
        summary = await outsideBudget((sig) => summarizeTurns(provider, summary, plan.fold, sig));
        if (provider.name !== 'mock') {
          spendGuard.record(budgetKey, chatModel, {
            inputTokens: estimateTokens(JSON.stringify(plan.fold)),
            outputTokens: estimateTokens(summary),
          });
        }
        history = plan.keep;
        emit('summary', { text: summary, summarizedCount: summarizedCount + plan.fold.length });
        console.info(`[copilot:loop] Compacted ${plan.fold.length} messages into the summary.`);
      } catch (err) {
        // Summary failed → hard cut, previous summary kept.
        console.warn('[copilot:loop] Summary failed, keeping the last messages only:', err);
        history = messages.slice(-COPILOT_HISTORY_LIMIT);
      }
    }

    // Localized system prompt + summary + history (media once, old answers cut)
    const systemPromptContent = getSystemPrompt(locale);
    const trimmedInputMessages = compactHistory(history, Infinity);
    const chatHistory: ChatMessage[] = [
      { role: 'system', content: systemPromptContent },
      ...(summary ? [{ role: 'system' as const, content: summaryNote(summary) }] : []),
      // Hour shown in the app → "now" in a request (K2). Only when the client sent it.
      ...(options.hour !== undefined
        ? [{ role: 'system' as const, content: appHourNote(options.hour) }]
        : []),
      ...(options.retry ? [{ role: 'system' as const, content: RETRY_NOTE }] : []),
      ...trimmedInputMessages.map((m) => ({
        role: m.role,
        content: m.content,
        media: m.media,
      })),
    ];

    console.info(
      `[copilot:loop] History sent: ${trimmedInputMessages.length}/${messages.length} messages, ` +
        `${trimmedInputMessages.reduce((n, m) => n + (m.media?.length ?? 0), 0)} media, ` +
        `~${estimateTokens(JSON.stringify(trimmedInputMessages))} tokens (text)`
    );

    let rounds = 0;
    let completed = false;

    while (rounds < MAX_TOOL_ROUNDS && !completed) {
      if (signal?.aborted) throw new Error('Copilot request aborted by the client');
      // Chat budget spent between rounds → the offline copilot (instant) finishes the turn.
      if (timeoutController.signal.aborted && activeProvider.name !== 'mock') {
        console.warn(`[copilot:loop] Chat budget (${chatBudgetMs}ms) spent, finishing offline.`);
        emit('error', {
          code: 'PROVIDER_FALLBACK',
          reason: 'timeout',
          message: 'AI provider unavailable — showing deterministic explanation.',
        });
        activeProvider = offline();
      }
      rounds++;
      console.info(
        `[copilot:loop] Round ${rounds}/${MAX_TOOL_ROUNDS} — requesting turn from "${activeProvider.name}"...`
      );

      if (capReached()) switchToMockForCap();

      let turn;
      try {
        try {
          turn = await activeProvider.chat(
            chatHistory,
            ALL_TOOL_DEFINITIONS,
            timeoutController.signal
          );
        } catch (firstErr) {
          if (
            activeProvider.name === 'mock' ||
            timeoutController.signal.aborted ||
            !isTransientProviderError(firstErr)
          ) {
            throw firstErr;
          }
          console.warn('[copilot:loop] Transient provider error, retrying once:', firstErr);
          turn = await activeProvider.chat(
            chatHistory,
            ALL_TOOL_DEFINITIONS,
            timeoutController.signal
          );
        }
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
          const timedOut = timeoutController.signal.aborted && !signal?.aborted;
          emit('error', {
            code: 'PROVIDER_FALLBACK',
            reason: timedOut ? 'timeout' : 'provider_error',
            message: 'AI provider unavailable — showing deterministic explanation.',
          });
          activeProvider = offline();
          // The chat budget may be spent: the offline copilot only follows the caller's signal.
          turn = await activeProvider.chat(chatHistory, ALL_TOOL_DEFINITIONS, signal);
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

          // Playback / time cursor: the client runs it at once (no scenario change).
          if (toolResult.control) {
            emit('control', toolResult.control);
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

    // Tool rounds used up without an answer → the offline copilot explains the last tool result.
    if (!completed && chatHistory.at(-1)?.role === 'tool') {
      console.warn('[copilot:loop] No answer after the last tool round, finishing offline.');
      const last = await offline().chat(chatHistory, ALL_TOOL_DEFINITIONS, signal);
      if (last.content) emit('delta', { text: last.content });
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
