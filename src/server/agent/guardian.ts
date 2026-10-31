import "server-only";

import { clock, duration } from "@/lib/format";
import type { AgentEvent, NoticeBlock, NoticeFlight } from "@/lib/types";
import { norba } from "../norba";
import { mockDisrupt } from "../norba/mock";
import { keepOrder } from "./servicing-tools";
import { ownerOf, peek, pushUpdate, type Session } from "./sessions";
import { blockId } from "./tools";

/*
 * The trip guardian. Airlines change bookings on their own — a flight moved, cancelled, renumbered — and Norba sends
 * order.schedule_changed when they do. The notice reaches the conversation that made the booking; the chat hands it
 * to the agent, which reads the airline's own notice, says in one sentence what changed for the traveller, and looks
 * for better flights at once. In mock mode the same notice can be simulated from the booking card.
 */

/** A Norba webhook envelope for order.schedule_changed, as received or as simulated. */
export type Envelope = {
  id: string;
  type: string;
  created_at: string;
  sequence?: number;
  data: { order_id: string; pnr?: string; airline: string; environment?: string; notification_id?: number; changes?: { before: NoticeFlight; after: NoticeFlight }[] };
};

export type Notice = { id: string; envelope: Envelope; receivedAt: number; simulated: boolean; handled?: boolean };

/** "2026-12-11T19:40Z": the minute-precision UTC Norba's webhooks use. */
const utcMinute = (iso: string) => `${new Date(Date.parse(iso)).toISOString().slice(0, 16)}Z`;

/** A notice for a conversation's booking: kept on the session and announced to the chat's next poll. */
export function receive(envelope: Envelope, simulated: boolean) {
  const s = peek(ownerOf(envelope.data.order_id));
  if (!s) return false;
  if (s.notices.some((n) => n.envelope.id === envelope.id)) return true;
  const notice: Notice = { id: `n_${crypto.randomUUID().slice(0, 8)}`, envelope, receivedAt: Date.now(), simulated };
  s.notices.push(notice);
  pushUpdate(s, { type: "notice", noticeId: notice.id });
  return true;
}

/** Mock mode: the airline moves the conversation's latest booked flight by `minutes`, and says so as Norba would. */
export function simulateScheduleChange(s: Session, minutes: number) {
  const order = s.orders.at(-1);
  if (!order) throw new Error("There is no booking in this conversation yet.");
  const { order: moved, before, after } = mockDisrupt(order.order_id, 0, "retimed", minutes);
  keepOrder(s, moved);
  const flight = (x: typeof before): NoticeFlight => ({
    flight_number: x.segments[0].flight_number ?? "",
    origin: x.origin,
    destination: x.destination,
    departure_utc: utcMinute(x.departure_utc),
    arrival_utc: utcMinute(x.arrival_utc),
  });
  const envelope: Envelope = {
    id: crypto.randomUUID(),
    type: "order.schedule_changed",
    created_at: new Date().toISOString(),
    sequence: Date.now() * 1000,
    data: { order_id: order.order_id, pnr: order.pnr, airline: order.airline, environment: "sandbox", notification_id: Math.floor(Math.random() * 1e6), changes: [{ before: flight(before), after: flight(after) }] },
  };
  receive(envelope, true);
  return envelope;
}

/** "+4h 00m later" for a moved departure. */
function shift(c: { before: NoticeFlight; after: NoticeFlight }) {
  if (!c.before) return "a flight was added";
  if (!c.after) return "the flight was cancelled";
  const m = Math.round((Date.parse(c.after.departure_utc) - Date.parse(c.before.departure_utc)) / 60_000);
  return m === 0 ? "same time, other details changed" : `${duration(Math.abs(m))} ${m > 0 ? "later" : "earlier"}`;
}

/**
 * The agent's turn on a notice: the notice drawn in the chat, the booking read again from the airline, and a note
 * for the model with the airline's own words and what the change does to a group trip the booking belongs to.
 */
export async function noticeTurn(s: Session, noticeId: string, emit: (e: AgentEvent) => void) {
  const n = s.notices.find((x) => x.id === noticeId);
  if (!n) return "[Airline notice] It could not be found any more.";
  n.handled = true;
  const d = n.envelope.data;
  const changes = d.changes ?? [];
  const block: NoticeBlock = { kind: "notice", id: blockId(), orderId: d.order_id, pnr: d.pnr, airline: d.airline, changes, raw: JSON.stringify(n.envelope, null, 2), simulated: n.simulated };
  emit({ type: "block", block });

  let order = s.orders.find((o) => o.order_id === d.order_id);
  try {
    if (order) {
      order = await norba().getOrder(order.order_id, order.airline);
      keepOrder(s, order);
    }
  } catch {
    // The notice itself says what changed; a failed re-read only means the copy is a few seconds older.
  }
  const moved = changes.find((c) => c.before || c.after);
  const sliceIndex = Math.max(0, order?.slices?.findIndex((x) => x.segments.some((g) => g.flight_number === (moved?.after ?? moved?.before)?.flight_number)) ?? 0);
  if (order) s.disruption = { orderId: order.order_id, sliceIndex };

  const lines = [
    `[Airline notice${n.simulated ? ", simulated in mock mode" : ""}] The airline changed booking ${d.pnr ?? d.order_id} on its own initiative. The notice as Norba received it:`,
    JSON.stringify(n.envelope.data),
    ...changes.map((c) => `Change: ${c.before ? `${c.before.flight_number} ${c.before.origin}→${c.before.destination} departing ${c.before.departure_utc}` : "new flight"} → ${c.after ? `departing ${c.after.departure_utc}, arriving ${c.after.arrival_utc}` : "cancelled"} (${shift(c)}). Times are UTC; local clocks: ${c.after ? `${clock(order?.slices?.[sliceIndex]?.departure_utc ?? c.after.departure_utc)} local departure` : "n/a"}.`),
  ];
  // A booking that is one seat of a group trip: say where the others land, so the traveller knows if they still meet.
  for (const g of s.groups.values()) {
    const lane = g.block.lanes.find((l) => l.hold?.pnr && l.hold.pnr === d.pnr);
    const newArrival = order?.slices?.[sliceIndex]?.arrival_utc;
    if (lane && newArrival) {
      const others = g.block.lanes.filter((l) => l !== lane && l.choice).map((l) => `${l.name} lands ${clock(l.choice!.outbound.arrival_utc)}`);
      lines.push(`This is ${lane.name}'s seat in the group trip "${g.block.title}": ${lane.name} now lands ${clock(newArrival)}; ${others.join(", ")}. The group's window was ${g.block.windowMinutes} min.`);
    }
  }
  lines.push("Say in one sentence what changed for the traveller, then call find_rebooking for this booking so they can switch if they prefer.");
  return lines.join("\n");
}
