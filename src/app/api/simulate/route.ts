import { simulateScheduleChange } from "@/server/agent/guardian";
import { peek } from "@/server/agent/sessions";
import { norbaMode } from "@/server/config";

export const dynamic = "force-dynamic";

/**
 * Mock mode only: the mock airline moves the conversation's latest booked flight, and its notice arrives as Norba's
 * order.schedule_changed would. With a Norba key, notices come from the airline through /api/webhooks/norba.
 */
export async function POST(req: Request) {
  if (norbaMode() !== "mock") return Response.json({ error: "Simulations run in mock mode only" }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { conversationId?: string; minutes?: number };
  const s = peek(body.conversationId);
  if (!s) return Response.json({ error: "No such conversation" }, { status: 404 });
  const minutes = typeof body.minutes === "number" && Math.abs(body.minutes) <= 24 * 60 ? Math.round(body.minutes) : 240;
  try {
    const envelope = simulateScheduleChange(s, minutes);
    return Response.json({ ok: true, event: envelope.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
