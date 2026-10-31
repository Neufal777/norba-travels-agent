import "server-only";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, money } from "@/lib/format";
import type { Order, RebookBlock, RebookOption } from "@/lib/types";
import { norba } from "../norba";
import { learnPlaces, offerCodes, placeLabel } from "./places";
import type { Session } from "./sessions";
import { blockId, failure, str, type Tool, type ToolContext } from "./tools";

/*
 * After the booking: the airline cancels or moves a flight, or the traveller photographs a board that says so. The
 * model can look for other flights (find_rebooking); only the traveller's Switch button changes the booking
 * (change_flight), as only the Pay button books.
 */

/** Rebooking offers shown in a block, kept so a Switch can be checked against what was offered. */
export type StoredRebook = { block: RebookBlock; orderId: string; sliceIndex: number; options: RebookOption[]; idempotency: Map<string, string> };

/** The order a reference names (booking reference or order id); without one, the disrupted or latest order. */
export function findOrder(s: Session, ref?: string): Order | undefined {
  const r = (ref ?? "").trim().toUpperCase();
  if (r) return s.orders.find((o) => o.pnr?.toUpperCase() === r || o.order_id.toUpperCase() === r);
  if (s.disruption) return s.orders.find((o) => o.order_id === s.disruption!.orderId);
  return s.orders.at(-1);
}

/** Replaces a conversation's copy of an order with what the airline answered. */
export function keepOrder(s: Session, order: Order) {
  const i = s.orders.findIndex((o) => o.order_id === order.order_id);
  if (i >= 0) s.orders[i] = order;
  else s.orders.push(order);
  if (s.trip.order?.order_id === order.order_id) s.trip.order = order;
}

const sliceLine = (s: Session, o: { origin: string; destination: string; departure_utc: string; arrival_utc: string; segments: { flight_number?: string }[] }) =>
  `${dateLabel(o.departure_utc.slice(0, 10))} ${clock(o.departure_utc)} ${placeLabel(s, o.origin)} → ${clock(o.arrival_utc)} ${placeLabel(s, o.destination)} (${o.segments.map((g) => g.flight_number).join(", ")})`;

const findRebooking: Tool = {
  schema: {
    type: "function",
    function: {
      name: "find_rebooking",
      description:
        "Other flights for a BOOKED order whose flight was cancelled, delayed or moved by the airline (from a departure board photo or an airline notice), or that the traveller wants to move. Shows the alternatives with a Switch button each; the traveller's press changes the booking, never you.",
      parameters: {
        type: "object",
        properties: {
          order: { type: "string", description: "Booking reference or order id; omit for the disrupted or latest booking" },
          flight: { type: "string", enum: ["outbound", "return"], description: "Which flight of the order; omit for the disrupted one, else outbound" },
          date: { type: "string", description: "YYYY-MM-DD to look on; omit for the same day" },
          reason: { type: "string", description: "Why, in a few words the traveller understands (e.g. 'Your 19:40 flight is cancelled')" },
        },
        required: ["reason"],
      },
    },
  },
  label: () => "Looking for other flights with the airline",
  async run(a, ctx) {
    const s = ctx.session;
    const order = findOrder(s, str(a.order));
    if (!order) return { content: "ERROR: there is no booking in this conversation to change." };
    const sliceIndex = str(a.flight) === "return" ? 1 : str(a.flight) === "outbound" ? 0 : s.disruption?.orderId === order.order_id ? s.disruption.sliceIndex : 0;
    const current = order.slices?.[sliceIndex];
    if (!current) return { content: `ERROR: booking ${order.pnr ?? order.order_id} has no ${sliceIndex ? "return" : "outbound"} flight.` };
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(a.date)) ? str(a.date) : undefined;
      const offers = await norba().reshop(order, { sliceIndex, date, segmentIds: current.segments.map((g) => g.segment_id!).filter(Boolean) });
      await learnPlaces(ctx, offerCodes(offers));
      const options: RebookOption[] = offers.map((o, i) => ({ offerId: o.offer_id, ref: `r${i + 1}`, slice: o.slices[0], amount: o.total_amount, currency: o.currency, airline: o.airline }));
      const block: RebookBlock = { kind: "rebook", id: blockId(), orderId: order.order_id, pnr: order.pnr, reason: str(a.reason) || "Other flights", current, options };
      s.rebooks.set(block.id, { block, orderId: order.order_id, sliceIndex, options, idempotency: new Map() });
      ctx.emit({ type: "block", block });
      if (!options.length) return { content: `No other flights for booking ${order.pnr ?? order.order_id} on that day. Offer another day.`, detail: "none" };
      return {
        content: [
          `Current: ${sliceLine(s, current)}. Alternatives shown with a Switch button (the traveller presses it; you never change the booking):`,
          ...options.map((o) => `- ${o.ref}: ${sliceLine(s, o.slice)} · ${o.amount > 0 ? `costs ${money(o.amount, o.currency)} more` : o.amount < 0 ? `${money(-o.amount, o.currency)} back` : "no cost"}`),
        ].join("\n"),
        detail: `${options.length} option${options.length > 1 ? "s" : ""}`,
      };
    } catch (e) {
      return failure(e);
    }
  },
};

/** Not offered to the model: the Switch button runs it with the option the traveller pressed. */
export const changeFlight: Tool = {
  schema: {
    type: "function",
    function: { name: "change_flight", description: "Internal: runs on the traveller's Switch press.", parameters: { type: "object", properties: {} } },
  },
  label: () => "Changing the flight with the airline",
  async run(a, ctx: ToolContext) {
    const s = ctx.session;
    const stored = s.rebooks.get(str(a.blockId));
    const option = stored?.options.find((o) => o.offerId === str(a.offerId));
    const order = stored && s.orders.find((o) => o.order_id === stored.orderId);
    if (!stored || !option || !order) return { content: "ERROR: that alternative is no longer on offer; look for flights again." };
    if (option.amount > 0) return { content: `ERROR: this alternative costs ${money(option.amount, option.currency)} more; paying a change is not done in the chat yet. Offer a free alternative or another day.` };
    // One key per option pressed: pressing it twice never changes the booking twice.
    const key = stored.idempotency.get(option.offerId) ?? crypto.randomUUID();
    stored.idempotency.set(option.offerId, key);
    try {
      const { order: changed } = await norba().changeOrder(order, option.offerId, key);
      keepOrder(s, changed);
      if (s.disruption?.orderId === changed.order_id) s.disruption = undefined;
      stored.block = { ...stored.block, switched: option.offerId };
      ctx.emit({ type: "patch", block: stored.block });
      ctx.emit({ type: "block", block: { kind: "booking", id: blockId(), order: changed } });
      return {
        content: `Changed: booking ${changed.pnr ?? changed.order_id} now flies ${sliceLine(s, option.slice)} with ${airlineName(option.airline)}, status ${changed.status}${option.amount < 0 ? `, ${money(-option.amount, option.currency)} back` : ", no cost"}.`,
        detail: changed.pnr ?? changed.order_id,
      };
    } catch (e) {
      return failure(e);
    }
  },
};

export const SERVICING_TOOLS: Tool[] = [findRebooking];
