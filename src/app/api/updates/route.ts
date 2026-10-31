import { peek } from "@/server/agent/sessions";

export const dynamic = "force-dynamic";

/** What happened in a conversation since the chat last asked: a friend paid their link, an airline moved a flight. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = peek(url.searchParams.get("c") ?? undefined);
  const after = Number(url.searchParams.get("after") ?? 0) || 0;
  if (!s) return Response.json({ seq: 0, events: [] });
  return Response.json({ seq: s.seq, events: s.outbox.filter((u) => u.seq > after).map((u) => u.event) }, { headers: { "Cache-Control": "no-store" } });
}
