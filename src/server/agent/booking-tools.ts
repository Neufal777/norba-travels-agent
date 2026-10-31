import "server-only";

import { airlineName } from "@/lib/airlines";
import { money } from "@/lib/format";
import type { Segment } from "@/lib/types";
import { norbaEnvironment } from "../config";
import { norba, NorbaError } from "../norba";
import { step } from "./trip";
import { blockId, failure, str, type Tool, type ToolContext } from "./tools";

/*
 * From a priced offer to e-tickets. Each tool checks that the steps before it are settled and says so plainly when
 * they are not, so the model always knows what to call next. Forms (seats, extras, travellers, card) are answered
 * by the traveller in the chat; what they send is stored by forms.ts, never read back to the model in full.
 */

const settled = (s: { status: string }) => s.status === "done" || s.status === "skipped";

function needPriced(ctx: ToolContext) {
  const t = ctx.session.trip;
  if (!t.priced) return "ERROR: no flight is priced yet; call price_offer with the traveller's chosen ref first.";
  if (t.view.steps.booking.status === "done") return "ERROR: this trip is already booked.";
  return undefined;
}

function holdEnded(ctx: ToolContext) {
  const until = ctx.session.trip.priced?.price_guaranteed_until;
  return Boolean(until && Date.parse(until) < Date.now() + 30_000);
}

const segmentsOf = (ctx: ToolContext): Segment[] => ctx.session.trip.priced?.slices.flatMap((s) => s.segments) ?? [];

const chooseSeats: Tool = {
  schema: {
    type: "function",
    function: {
      name: "choose_seats",
      description: "Show the airline's seat maps for the priced flight so the traveller picks seats (or skips) in the chat. Call after price_offer.",
      parameters: { type: "object", properties: {} },
    },
  },
  label: () => "Opening the seat maps",
  async run(_a, ctx) {
    const missing = needPriced(ctx);
    if (missing) return { content: missing, detail: "not priced" };
    const t = ctx.session.trip;
    const offer = t.priced!;
    step(ctx, "seats", "running", undefined, `Asking ${airlineName(offer.airline)} for the seat maps`);
    try {
      const segs = segmentsOf(ctx).filter((g) => g.segment_id);
      const maps = await Promise.all(segs.map(async (segment) => ({ segment, map: await norba().seatMap(offer, segment.segment_id!) })));
      t.seatMaps = maps.filter((m): m is { segment: Segment; map: NonNullable<typeof m.map> } => Boolean(m.map?.seats?.length));
      if (!t.seatMaps.length) {
        step(ctx, "seats", "skipped", "The airline sells no seats in advance");
        return { content: "The airline offers no seat map for these flights: seats are assigned at check-in. Seats step skipped; next: choose_extras.", detail: "no seat map" };
      }
      ctx.emit({
        type: "block",
        block: { kind: "seats", id: blockId(), maps: t.seatMaps, pax: t.pax.filter((p) => p.type !== "INF"), currency: offer.currency },
      });
      step(ctx, "seats", "waiting", `Choose seats on ${t.seatMaps.length} flight${t.seatMaps.length > 1 ? "s" : ""}, or skip`);
      const free = t.seatMaps.map((m) => `${m.segment.origin}→${m.segment.destination}: ${m.map.seats.filter((x) => x.available).length} free`).join(", ");
      return { content: `Seat maps shown (${free}). Wait for the traveller to choose or skip in the form.`, detail: `${t.seatMaps.length} maps` };
    } catch (e) {
      step(ctx, "seats", "failed", e instanceof NorbaError ? (e.code ?? e.message) : (e as Error).message);
      return failure(e);
    }
  },
};

const chooseExtras: Tool = {
  schema: {
    type: "function",
    function: {
      name: "choose_extras",
      description: "Show the bags and extras the airline sells with the priced flight so the traveller adds some (or skips) in the chat. Call after seats are chosen or skipped.",
      parameters: { type: "object", properties: {} },
    },
  },
  label: () => "Loading bags & extras",
  async run(_a, ctx) {
    const missing = needPriced(ctx);
    if (missing) return { content: missing, detail: "not priced" };
    const t = ctx.session.trip;
    if (!settled(t.view.steps.seats)) step(ctx, "seats", "skipped", "Skipped");
    step(ctx, "extras", "running", undefined, `Asking ${airlineName(t.priced!.airline)} what it sells with this fare`);
    try {
      t.services = await norba().services(t.priced!);
      if (!t.services.length) {
        step(ctx, "extras", "skipped", "Nothing extra on sale");
        return { content: "The airline sells no extras with this fare. Extras skipped; next: ask_traveller_details.", detail: "none" };
      }
      ctx.emit({ type: "block", block: { kind: "extras", id: blockId(), services: t.services, pax: t.pax, segments: segmentsOf(ctx) } });
      step(ctx, "extras", "waiting", `${t.services.length} extras on sale · add or skip`);
      return { content: `Extras shown: ${t.services.map((s) => `${s.name} ${s.price ? money(s.price.amount, s.price.currency) : ""}`).join("; ")}. Wait for the traveller's choice in the form.`, detail: `${t.services.length} extras` };
    } catch (e) {
      step(ctx, "extras", "failed", e instanceof NorbaError ? (e.code ?? e.message) : (e as Error).message);
      return failure(e);
    }
  },
};

const skipStep: Tool = {
  schema: {
    type: "function",
    function: {
      name: "skip_step",
      description: "Skip seats or extras when the traveller says they do not want any.",
      parameters: { type: "object", properties: { step: { type: "string", enum: ["seats", "extras"] } }, required: ["step"] },
    },
  },
  label: (a) => `Skipping ${str(a.step)}`,
  async run(a, ctx) {
    const id = str(a.step) === "extras" ? "extras" : "seats";
    const t = ctx.session.trip;
    if (id === "seats") t.seats = [];
    else t.extras = [];
    step(ctx, id, "skipped", "Not wanted");
    return { content: `${id} skipped.`, detail: "skipped" };
  },
};

const askTravellers: Tool = {
  schema: {
    type: "function",
    function: {
      name: "ask_traveller_details",
      description:
        "Show the form for every traveller's name as on the passport, date of birth and gender, plus the contact email and phone. The traveller fills it in the chat; you never ask for these details in text and never repeat them.",
      parameters: { type: "object", properties: {} },
    },
  },
  label: () => "Opening the traveller form",
  async run(_a, ctx) {
    const missing = needPriced(ctx);
    if (missing) return { content: missing, detail: "not priced" };
    const t = ctx.session.trip;
    if (!settled(t.view.steps.seats)) step(ctx, "seats", "skipped", "Skipped");
    if (!settled(t.view.steps.extras)) step(ctx, "extras", "skipped", "Skipped");
    ctx.emit({ type: "block", block: { kind: "travellers", id: blockId(), pax: t.pax, international: true, prefill: t.travellers } });
    step(ctx, "travellers", "waiting", `Details for ${t.pax.length} traveller${t.pax.length > 1 ? "s" : ""}`);
    return { content: "Traveller form shown. Wait for the traveller to submit it.", detail: `${t.pax.length} travellers` };
  },
};

const reviewPrice: Tool = {
  schema: {
    type: "function",
    function: {
      name: "review_price",
      description: "Quote the whole booking — fare, seats, extras and service fee — exactly as it will be charged, and show it line by line. Call once the traveller details are in.",
      parameters: { type: "object", properties: {} },
    },
  },
  label: () => "Adding up the total",
  async run(_a, ctx) {
    const missing = needPriced(ctx);
    if (missing) return { content: missing, detail: "not priced" };
    const t = ctx.session.trip;
    if (!t.travellers) return { content: "ERROR: traveller details are missing; call ask_traveller_details first.", detail: "no travellers" };
    step(ctx, "review", "running", undefined, "Pricing the fare, seats and extras together");
    try {
      const q = await norba().quote(t.priced!, t.seats, t.extras);
      t.quote = q;
      const lines = [
        { label: `Fare · ${t.pax.length} traveller${t.pax.length > 1 ? "s" : ""}`, amount: q.fare_total },
        ...(q.extras ? [{ label: `Seats & extras`, amount: q.extras }] : []),
        ...(q.service_fee ? [{ label: "Service fee", amount: q.service_fee }] : []),
      ];
      ctx.emit({
        type: "block",
        block: { kind: "review", id: blockId(), quote: q, offer: t.priced!, lines, travellers: t.travellers.passengers.map((p) => `${p.first_name} ${p.last_name}`) },
      });
      step(ctx, "review", "done", `Total ${money(q.total, q.currency, { cents: true })}`);
      return { content: `Total ${money(q.total, q.currency, { cents: true })} (fare ${q.fare_total}, extras ${q.extras}, service fee ${q.service_fee}). Next: ask_payment.`, detail: money(q.total, q.currency, { cents: true }) };
    } catch (e) {
      step(ctx, "review", "failed", e instanceof NorbaError ? (e.code ?? e.message) : (e as Error).message);
      return failure(e);
    }
  },
};

const askPayment: Tool = {
  schema: {
    type: "function",
    function: {
      name: "ask_payment",
      description:
        "Show the card form with the reviewed total. The booking is made only when the traveller presses Pay in that form; never ask for card numbers in text. Call after review_price.",
      parameters: { type: "object", properties: {} },
    },
  },
  label: () => "Opening the payment form",
  async run(_a, ctx) {
    const missing = needPriced(ctx);
    if (missing) return { content: missing, detail: "not priced" };
    const t = ctx.session.trip;
    if (!t.quote || t.view.steps.review.status !== "done") return { content: "ERROR: review the price first with review_price.", detail: "no quote" };
    if (holdEnded(ctx)) return { content: "ERROR offer_not_priced: the airline's price hold has ended; call price_offer again for the same ref, then review_price.", detail: "hold ended" };
    ctx.emit({
      type: "block",
      block: { kind: "payment", id: blockId(), amount: t.quote.total, currency: t.quote.currency, environment: norbaEnvironment(), holdUntil: t.priced!.price_guaranteed_until },
    });
    step(ctx, "payment", "waiting", `Card details · ${money(t.quote.total, t.quote.currency, { cents: true })}`);
    return { content: "Payment form shown. The booking starts when the traveller presses Pay.", detail: money(t.quote.total, t.quote.currency, { cents: true }) };
  },
};

/** Not offered to the model: it runs when the traveller presses Pay, so only a person can spend money. */
export const bookTrip: Tool = {
  schema: { type: "function", function: { name: "book_trip", description: "Internal", parameters: { type: "object", properties: {} } } },
  label: () => "Booking with the airline",
  async run(_a, ctx) {
    const t = ctx.session.trip;
    const pay = t.payment;
    try {
      if (!t.priced || !t.quote || !t.travellers || !pay) return { content: "ERROR: the booking is missing the priced flight, the review, the travellers or the card.", detail: "incomplete" };
      if (pay.amount + 0.005 < t.quote.total) return { content: `ERROR: the card was approved for ${pay.amount} but the total is ${t.quote.total}; ask for payment again.`, detail: "amount changed" };
      if (holdEnded(ctx)) {
        step(ctx, "payment", "pending");
        step(ctx, "booking", "failed", "The price hold ended before payment");
        return { content: "ERROR offer_not_priced: the price hold ended. Nothing was charged. Call price_offer again for the same ref, then review_price and ask_payment.", detail: "hold ended" };
      }
      t.idempotencyKey ??= crypto.randomUUID();
      step(ctx, "booking", "running", undefined, `${airlineName(t.priced.airline)} is creating the order and taking the payment`);
      const { order, outcomeUnknown } = await norba().createOrder(
        {
          offer: t.priced,
          passengers: t.travellers.passengers,
          contact: t.travellers.contact,
          seats: t.seats,
          extras: t.extras,
          payment: { amount: pay.amount, currency: pay.currency, card: pay.card },
          locale: ctx.session.lang === "es" ? "es" : "en",
        },
        t.idempotencyKey,
      );
      t.order = order;
      t.view.pnr = order.pnr;
      ctx.emit({ type: "block", block: { kind: "booking", id: blockId(), order, outcomeUnknown } });
      step(ctx, "booking", "done", `${order.pnr ? `Reference ${order.pnr}` : order.order_id} · ${order.status}`);
      const issued = (order.tickets ?? []).filter((x) => x.ticket_number && (x.type ?? "ticket") === "ticket");
      if (outcomeUnknown) step(ctx, "tickets", "failed", "Payment outcome unknown — do not pay again");
      else if (issued.length) step(ctx, "tickets", "done", `${issued.length} e-ticket${issued.length > 1 ? "s" : ""} issued`, `Booked · reference ${order.pnr ?? order.order_id}`);
      else step(ctx, "tickets", "waiting", "The airline has not issued the tickets yet");
      return {
        content: `Booked: order ${order.order_id}, booking reference ${order.pnr ?? "pending"}, status ${order.status}, ${issued.length} e-tickets${order.environment === "sandbox" ? " (sandbox: nothing real was charged or issued)" : ""}.${outcomeUnknown ? " The payment answer was lost: the card may have been charged; do not pay again — contact support." : ""}${order.warnings?.length ? ` Airline notes: ${order.warnings.join("; ")}` : ""}`,
        detail: order.pnr ?? order.order_id,
      };
    } catch (e) {
      const unknown = e instanceof NorbaError && (e.code?.endsWith("_outcome_unknown") || e.status === 502);
      step(ctx, "booking", "failed", unknown ? "No answer from the airline — do not pay again" : e instanceof NorbaError ? e.message : (e as Error).message);
      // A definite refusal charges nothing: the traveller can try another card under a new booking key.
      if (!unknown) {
        t.idempotencyKey = undefined;
        step(ctx, "payment", "waiting", "Try again or use another card", "The booking was refused, nothing was charged · try again");
      }
      return failure(e);
    } finally {
      // Card data lives for the booking request only.
      t.payment = pay ? { ...pay, card: { number: "", holder: "", expiry_month: 0, expiry_year: 0 } } : undefined;
    }
  },
};

export const BOOKING_TOOLS: Tool[] = [chooseSeats, chooseExtras, skipStep, askTravellers, reviewPrice, askPayment];
