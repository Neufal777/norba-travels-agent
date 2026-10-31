/** The OpenAI-compatible Chat Completions shapes the Meta Model API speaks. */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

/** A piece of a multimodal user message: text, an image (URL or data URL) or a file such as a PDF (data URL). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type ChatTurn =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSchema = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type CompletionResult = { text: string; toolCalls: ToolCall[]; finishReason: string };
