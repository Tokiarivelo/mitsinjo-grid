import 'server-only';

import { type SimulationInput, type StrategyId } from '@mitsinjo/engine';
import { type LlmProvider, type ChatMessage } from './provider';
import { MockLlmProvider } from './providers/mock';
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools';
import { SYSTEM_PROMPT } from './prompt';

export type SseEventName = 'activity' | 'delta' | 'evidence' | 'proposal' | 'error' | 'done';

export type SseEmitter = (event: SseEventName, data: Record<string, unknown>) => void;

export interface CopilotLoopOptions {
  messages: { role: 'user' | 'assistant'; content: string }[];
  input: SimulationInput;
  strategy?: StrategyId;
  provider?: LlmProvider;
  emit: SseEmitter;
  signal?: AbortSignal;
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
  const { messages, input, strategy = 'proportional', emit, signal } = options;
  let activeProvider = options.provider || new MockLlmProvider();

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
    emit('activity', { tool: 'start', label: 'Reading microgrid simulation state...' });

    // Build context
    const toolCtx: ToolContext = {
      input,
      activeStrategy: strategy,
    };

    // Prepare message history: SYSTEM_PROMPT + last 8 messages
    const trimmedInputMessages = messages.slice(-8);
    const chatHistory: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...trimmedInputMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    let rounds = 0;
    let completed = false;

    while (rounds < MAX_TOOL_ROUNDS && !completed) {
      if (timeoutController.signal.aborted) {
        throw new Error('Copilot loop timed out');
      }
      rounds++;

      let turn;
      try {
        turn = await activeProvider.chat(chatHistory, TOOL_DEFINITIONS, timeoutController.signal);
      } catch (err) {
        // Fall back to MockLlmProvider on provider failure/timeout
        if (activeProvider.name !== 'mock') {
          emit('error', {
            code: 'PROVIDER_FALLBACK',
            message: 'AI provider unavailable — showing deterministic explanation.',
          });
          activeProvider = new MockLlmProvider();
          turn = await activeProvider.chat(chatHistory, TOOL_DEFINITIONS, timeoutController.signal);
        } else {
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
          // `label` is for logs; the UI translates from `tool` (+ `sector`).
          emit('activity', {
            tool: tc.name,
            sector: typeof tc.args.sector === 'string' ? tc.args.sector : undefined,
            label: getToolActivityLabel(tc.name, tc.args),
          });

          const toolResult = executeTool(tc.name, tc.args, toolCtx);

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
        completed = true;
      }
    }

    emit('done', {});
  } catch (err) {
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
