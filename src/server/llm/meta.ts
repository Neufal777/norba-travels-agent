import "server-only";

import { config } from "../config";
import type { ChatTurn, CompletionResult, ToolCall, ToolSchema } from "./types";

/*
 * Meta Model API over its OpenAI-compatible Chat Completions endpoint (POST {base}/chat/completions, Bearer key).
 * Two providers answer the same request: "meta" is Muse Spark on api.meta.ai; "open" is Muse Spark Open, the
 * open-weight model, served by a partner such as Baseten. Without a key for "open", Muse Spark stands in for it.
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

export type Provider = "meta" | "open";

/** One model call's settings: which provider, which model, how hard it thinks. */
export type CallOptions = { provider?: Provider; model?: string; effort?: string; signal?: AbortSignal };

function endpoint(o: CallOptions = {}) {
  const open = o.provider === "open" && config.openModel.apiKey;
  const p = open ? config.openModel : config.model;
  const effort = o.effort ?? (open ? "" : config.model.reasoningEffort);
  return { url: `${p.baseUrl}/chat/completions`, key: p.apiKey, model: o.model ?? p.id, effort, provider: (open ? "open" : "meta") as Provider };
}

/** The model a call with these options runs on, as the chat labels it. */
export const modelLabel = (o: CallOptions = {}) => endpoint(o).model;

async function failure(res: Response) {
  const text = await res.text().catch(() => "");
  let message = text.slice(0, 300);
  try {
    const j = JSON.parse(text);
    message = j.error?.message ?? j.error ?? j.message ?? message;
  } catch {}
  return new ModelError(`Model API ${res.status}: ${message || res.statusText}`, res.status);
}

const timeout = (signal?: AbortSignal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS));

type Delta = { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] };
type Chunk = { choices?: { delta?: Delta; message?: Delta & { tool_calls?: ToolCall[] }; finish_reason?: string | null }[] };

/**
 * One answer the program reads, not the traveller: the reply is held to a JSON schema (structured output) and parsed.
 * Images and PDFs ride in the messages as content parts, so this is also how the agent sees.
 */
export async function structured<T>(messages: ChatTurn[], name: string, schema: Record<string, unknown>, o: CallOptions = {}): Promise<T> {
  const e = endpoint(o);
  const body: Record<string, unknown> = {
    model: e.model,
    messages,
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
  };
  if (e.effort) body.reasoning_effort = e.effort;
  const res = await fetch(e.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${e.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: timeout(o.signal),
  });
  if (!res.ok) throw await failure(res);
  const j = (await res.json()) as Chunk;
  const content = j.choices?.[0]?.message?.content ?? "";
  // Some open-weight servers wrap JSON in a code fence even under a schema.
  const raw = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ModelError(`${e.model} answered something that is not the JSON asked for`, 502);
  }
}

export async function complete(messages: ChatTurn[], tools: ToolSchema[], onText: (delta: string) => void, signal?: AbortSignal, o: CallOptions = {}): Promise<CompletionResult> {
  const e = endpoint(o);
  const body: Record<string, unknown> = {
    model: e.model,
    messages,
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    stream: true,
  };
  if (e.effort) body.reasoning_effort = e.effort;

  const res = await fetch(e.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${e.key}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: timeout(signal ?? o.signal),
  });
  if (!res.ok || !res.body) throw await failure(res);

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
