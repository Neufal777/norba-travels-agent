import { session } from "@/server/agent/sessions";
import { config } from "@/server/config";
import { MCP_TOOLS } from "@/server/mcp";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/*
 * The MCP (Model Context Protocol) endpoint over Streamable HTTP: JSON-RPC 2.0 in a POST, one JSON answer out. Any
 * MCP client — a desktop assistant, an agent framework, another company's bot — connects to /api/mcp and gets Norba's
 * flight tools. Mcp-Session-Id keeps a client's searches, so the refs it saw stay valid for create_checkout.
 */

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER = { name: "norba", title: "Norba — real airline bookings for any AI assistant", version: "0.1.0" };
const INSTRUCTIONS =
  "Search real airline offers with search_flights (resolve city names with find_airports first), then call create_checkout for the one the traveller picks and give them the link. The traveller books on that page; never ask for card or passport details. Prices are totals for all travellers.";

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const reply = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

function baseUrl(req: Request) {
  if (config.publicUrl) return config.publicUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3200";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function handle(m: RpcRequest, sid: string, req: Request) {
  switch (m.method) {
    case "initialize": {
      const asked = String(m.params?.protocolVersion ?? "");
      return reply(m.id, { protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
    }
    case "ping":
      return reply(m.id, {});
    case "tools/list":
      return reply(m.id, { tools: MCP_TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })) });
    case "tools/call": {
      const name = String(m.params?.name ?? "");
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) return fail(m.id, -32602, `Unknown tool: ${name}`);
      const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
      const r = await tool.run(args, { session: session(sid), baseUrl: baseUrl(req), signal: req.signal });
      return reply(m.id, { content: [{ type: "text", text: r.text }], ...(r.structured ? { structuredContent: r.structured } : {}), isError: Boolean(r.isError) });
    }
    default:
      return fail(m.id, -32601, `Method not found: ${m.method}`);
  }
}

export async function POST(req: Request) {
  if (config.mcp.token && req.headers.get("authorization") !== `Bearer ${config.mcp.token}`) {
    return Response.json(fail(null, -32001, "Unauthorized"), { status: 401, headers: { ...CORS, "WWW-Authenticate": "Bearer" } });
  }
  const body = (await req.json().catch(() => undefined)) as RpcRequest | RpcRequest[] | undefined;
  if (!body) return Response.json(fail(null, -32700, "Parse error"), { status: 400, headers: CORS });
  const batch = Array.isArray(body) ? body : [body];
  // A client's session is its conversation here: initialize opens one, later calls name it in Mcp-Session-Id.
  const given = req.headers.get("mcp-session-id") ?? "";
  const sid = batch.some((m) => m.method === "initialize") || !given ? session().id : session(given).id;
  const answers = [];
  for (const m of batch) {
    if (m?.jsonrpc !== "2.0" || typeof m.method !== "string") {
      answers.push(fail(m?.id, -32600, "Invalid request"));
      continue;
    }
    // Notifications (no id) get no answer.
    if (m.id === undefined || m.id === null) continue;
    answers.push(await handle(m, sid, req));
  }
  const headers = { ...CORS, "Mcp-Session-Id": sid };
  if (!answers.length) return new Response(null, { status: 202, headers });
  return Response.json(Array.isArray(body) ? answers : answers[0], { headers });
}

/** No server-to-client stream: every answer comes back on its POST. */
export function GET() {
  return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, DELETE, OPTIONS" } });
}

export function DELETE() {
  return new Response(null, { status: 204, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
