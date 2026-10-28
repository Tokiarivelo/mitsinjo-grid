import 'server-only';

import { type SimulationInput, type StrategyId } from '@mitsinjo/engine';
import { type LlmProvider, type ChatMessage } from './provider';
import { MockLlmProvider } from './providers/mock';
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools';
import { getSystemPrompt } from './prompt';
import { detectAdaptiveRoute } from './adaptive-router';

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
  | 'model';

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
}

const MAX_TOOL_ROUNDS = 4;
const TIMEOUT_MS = 20_000;

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
  } = options;
  let activeProvider = options.provider || new MockLlmProvider();

  // Find user prompt for adaptive routing
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userQuery = lastUserMsg?.content || '';

  const route = detectAdaptiveRoute(userQuery, requestedModel, availableModels);
  console.info(
    `[copilot:loop] Adaptive route selected: model="${route.targetModel}", modality="${route.modality}" (${route.reason})`
  );

  emit('model', {
    model: route.targetModel,
    modality: route.modality,
    reason: route.reason,
  });

  // Create timeout controller for the 20s overall budget
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new Error('Copilot loop exceeded 20s budget'));
  }, TIMEOUT_MS);

  // Combine caller signal and timeout
  const abortListener = () => timeoutController.abort(signal?.reason);
  if (signal) {
    signal.addEventListener('abort', abortListener, { once: true });
  }

  try {
    // ── IMAGE MODALITY BRANCH ─────────────────────────────
    if (route.modality === 'image') {
      emit('activity', {
        tool: 'image_generation',
        label:
          locale === 'fr'
            ? `Génération visuelle avec ${route.targetModel}...`
            : `Generating visual with ${route.targetModel}...`,
      });

      if (typeof activeProvider.generateImage === 'function') {
        const imgResult = await activeProvider.generateImage(userQuery, timeoutController.signal);
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

    // ── REASONING / CHAT MODALITY BRANCH ──────────────────
    emit('activity', { tool: 'start', label: 'Reading microgrid simulation state...' });

    // Update active model on provider if supported
    if ('setModel' in activeProvider && typeof activeProvider.setModel === 'function') {
      activeProvider.setModel(route.targetModel);
    }

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

      let turn;
      try {
        turn = await activeProvider.chat(chatHistory, TOOL_DEFINITIONS, timeoutController.signal);
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
          turn = await activeProvider.chat(chatHistory, TOOL_DEFINITIONS, timeoutController.signal);
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
