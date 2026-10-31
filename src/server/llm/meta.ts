import "server-only";

import { config } from "../config";
import type { ChatTurn, CompletionResult, ToolCall, ToolSchema } from "./types";

/*
 * Meta Model API over its OpenAI-compatible Chat Completions endpoint (POST {base}/chat/completions, Bearer key).
 * Nothing here is Meta-only: Llama open weights served by Baseten, Fireworks or Modal answer the same request, so
 * MODEL_BASE_URL + MODEL_ID switch provider.
 */

const TIMEOUT_MS = 120_000;

export class ModelError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

type Delta = { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] };
type Chunk = { choices?: { delta?: Delta; message?: Delta & { tool_calls?: ToolCall[] }; finish_reason?: string | null }[] };

export async function complete(messages: ChatTurn[], tools: ToolSchema[], onText: (delta: string) => void, signal?: AbortSignal): Promise<CompletionResult> {
  const body: Record<string, unknown> = {
    model: config.model.id,
    messages,
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    stream: true,
  };
  if (config.model.reasoningEffort) body.reasoning_effort = config.model.reasoningEffort;

  const res = await fetch(`${config.model.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.model.apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let message = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      message = j.error?.message ?? j.error ?? j.message ?? message;
    } catch {}
    throw new ModelError(`Model API ${res.status}: ${message || res.statusText}`, res.status);
  }

  // A provider that ignores `stream` answers one JSON body: read it the same way.
  if (!(res.headers.get("content-type") ?? "").includes("event-stream")) {
    const j = (await res.json()) as Chunk;
    const m = j.choices?.[0]?.message;
    if (m?.content) onText(m.content);
    return { text: m?.content ?? "", toolCalls: (m?.tool_calls as ToolCall[]) ?? [], finishReason: j.choices?.[0]?.finish_reason ?? "stop" };
  }

  let text = "";
  let finishReason = "stop";
  const calls: { id: string; name: string; args: string }[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let chunk: Chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const d = choice.delta ?? {};
      if (d.content) {
        text += d.content;
        onText(d.content);
      }
      for (const tc of d.tool_calls ?? []) {
        const c = (calls[tc.index] ??= { id: "", name: "", args: "" });
        if (tc.id) c.id = tc.id;
        if (tc.function?.name) c.name += tc.function.name;
        if (tc.function?.arguments) c.args += tc.function.arguments;
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }
  const toolCalls: ToolCall[] = calls
    .filter((c) => c?.name)
    .map((c, i) => ({ id: c.id || `call_${Date.now().toString(36)}_${i}`, type: "function", function: { name: c.name, arguments: c.args || "{}" } }));
  return { text, toolCalls, finishReason };
}
