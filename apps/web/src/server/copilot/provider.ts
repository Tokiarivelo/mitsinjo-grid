import 'server-only';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  media?: Array<{ type: 'image' | 'video'; url: string }>;
}

export interface LlmTurn {
  content?: string | null;
  toolCalls?: ToolCall[];
}

export interface LlmImageResult {
  imageUrl: string;
  caption?: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(messages: ChatMessage[], tools: ToolDefinition[], signal?: AbortSignal): Promise<LlmTurn>;
  generateImage?(prompt: string, signal?: AbortSignal): Promise<LlmImageResult>;
}
