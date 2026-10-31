/** The OpenAI-compatible Chat Completions shapes the Meta Model API speaks. */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatTurn =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSchema = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type CompletionResult = { text: string; toolCalls: ToolCall[]; finishReason: string };
