import { createHmac, timingSafeEqual } from "node:crypto";
import { receive, type Envelope } from "@/server/agent/guardian";

export const dynamic = "force-dynamic";

/** Older than this, a signed delivery is refused as a replay. */
const TOLERANCE_S = 300;

/** `t=<unix>,v1=<hex>[,v1=<hex>]`: HMAC-SHA256 of `<t>.<raw body>` with the endpoint's whsec_ secret; either v1 may match after a rotation. */
function verified(header: string | null, raw: string, secret: string) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCE_S) return false;
  const want = createHmac("sha256", secret).update(`${t}.${raw}`).digest();
  return parts.filter(([k]) => k === "v1").some(([, v]) => {
    const got = Buffer.from(v ?? "", "hex");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

/**
 * Norba's webhooks: order.schedule_changed reaches the conversation that made the booking, whose chat hands it to the
 * agent. Every delivery must carry a valid X-Norba-Signature; without NORBA_WEBHOOK_SECRET nothing is accepted.
 */
export async function POST(req: Request) {
  const secret = process.env.NORBA_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "webhooks are not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verified(req.headers.get("x-norba-signature"), raw, secret)) return Response.json({ error: "bad signature" }, { status: 401 });
  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return Response.json({ error: "not JSON" }, { status: 400 });
  }
  // Other events are acknowledged and left alone: the agent acts on schedule changes.
  if (envelope.type === "order.schedule_changed" && envelope.data?.order_id) receive(envelope, false);
  return Response.json({ ok: true });
}
