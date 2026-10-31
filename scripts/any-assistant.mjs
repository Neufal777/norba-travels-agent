#!/usr/bin/env node
/*
 * Any assistant, booking real flights through Norba's MCP server.
 *
 * A minimal terminal assistant on Muse Spark (Meta Model API) that knows nothing about flights: it connects to an MCP
 * (Model Context Protocol) server, lists the tools it offers, and lets the model use them. Point it at Norba and it can
 * search, price and hand out a checkout link — the same thing any other assistant gets from one connection.
 *
 *   node scripts/any-assistant.mjs                      # reads MODEL_API_KEY etc. from the environment or .env.local
 *   NORBA_MCP_URL=https://…/api/mcp node scripts/any-assistant.mjs "Book me Madrid to Athens on 11 December"
 */
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MODEL = { key: process.env.MODEL_API_KEY, base: (process.env.MODEL_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, ""), id: process.env.MODEL_ID || "muse-spark-1.3" };
const MCP_URL = process.env.NORBA_MCP_URL || "http://localhost:3200/api/mcp";
const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, red: (s) => `\x1b[38;2;239;3;2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m` };

if (!MODEL.key) {
  console.error("Set MODEL_API_KEY (Meta Model API) to run the assistant.");
  process.exit(1);
}

let session = "";
let nextId = 1;
async function rpc(method, params) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(session ? { "Mcp-Session-Id": session } : {}), ...(process.env.MCP_TOKEN ? { Authorization: `Bearer ${process.env.MCP_TOKEN}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  session = res.headers.get("mcp-session-id") || session;
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "any-assistant", version: "0.1.0" } });
const { tools } = await rpc("tools/list", {});
console.log(c.dim(`connected to ${init.serverInfo.title} · ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`));
console.log(c.dim(`thinking with ${MODEL.id}\n`));

const messages = [
  {
    role: "system",
    content: `You are a general-purpose assistant. Today is ${new Date().toISOString().slice(0, 10)}. You have tools from connected services; use them when they help and answer briefly. ${init.instructions ?? ""}`,
  },
];
const schemas = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }));

async function think() {
  for (let round = 0; round < 8; round++) {
    const res = await fetch(`${MODEL.base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${MODEL.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL.id, messages, tools: schemas, tool_choice: "auto" }),
    });
    if (!res.ok) throw new Error(`Model API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const msg = (await res.json()).choices[0].message;
    messages.push({ role: "assistant", content: msg.content ?? null, ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) });
    if (msg.content) console.log(`\n${c.bold("assistant")} ${msg.content}\n`);
    if (!msg.tool_calls?.length) return;
    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments || "{}");
      console.log(c.red("■ ") + c.dim(`norba.${call.function.name}(${JSON.stringify(args)})`));
      const r = await rpc("tools/call", { name: call.function.name, arguments: args });
      const text = r.content.map((p) => p.text).join("\n");
      console.log(c.dim(text.split("\n").slice(0, 4).map((l) => `  ${l}`).join("\n")) + (r.structuredContent?.payment_url ? `\n  ${c.green(r.structuredContent.payment_url)}` : ""));
      messages.push({ role: "tool", tool_call_id: call.id, content: text });
    }
  }
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
let closed = false;
rl.on("close", () => (closed = true));
// Input that ends (a pipe, Ctrl+D) ends the conversation.
const ask = async () => (closed ? "" : rl.question(c.bold("you ")).catch(() => ""));
let line = process.argv.slice(2).join(" ").trim() || (await ask());
while (line && line !== "exit") {
  messages.push({ role: "user", content: line });
  await think();
  line = await ask();
}
rl.close();
