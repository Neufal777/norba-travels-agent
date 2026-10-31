import "server-only";

import { STEP_LABELS, emptyTrip, isFinished } from "@/lib/steps";
import { STEPS, type AgentEvent, type Contact, type OfferQuote, type Order, type Passenger, type PaxSlot, type PricedOffer, type SearchRequest, type SeatMap, type Segment, type Service, type StepId, type StepStatus } from "@/lib/types";
import type { CardData, ChosenExtra, ChosenSeat } from "../norba/port";

/**
 * The trip behind a conversation: where it is among the twelve steps, and what the booking needs — the chosen and
 * priced offer, seats, extras, travellers, the quote and the card. Travellers and card live here only, never in the
 * model's transcript; the card is wiped once the booking has been attempted.
 */
export type TripState = {
  view: ReturnType<typeof emptyTrip>;
  request?: SearchRequest;
  pax: PaxSlot[];
  chosenRef?: string;
  priced?: PricedOffer;
  seatMaps: { segment: Segment; map: SeatMap }[];
  seats: ChosenSeat[];
  services: Service[];
  extras: ChosenExtra[];
  travellers?: { passengers: Passenger[]; contact: Contact };
  quote?: OfferQuote;
  payment?: { card: CardData; amount: number; currency: string; last4: string; brand: string; at: number };
  order?: Order;
  /** One per booking attempt, reused on its retries so the airline never books twice. */
  idempotencyKey?: string;
};

export const newTrip = (): TripState => ({ view: emptyTrip(), pax: [], seatMaps: [], seats: [], services: [], extras: [] });

type Ctx = { session: { trip: TripState }; emit: (e: AgentEvent) => void };

function recompute(t: TripState) {
  const v = t.view;
  const active = STEPS.find((id) => v.steps[id].status === "running" || v.steps[id].status === "waiting" || v.steps[id].status === "failed");
  const lastDone = [...STEPS].reverse().find((id) => isFinished(v.steps[id]));
  const next = lastDone ? STEPS.slice(STEPS.indexOf(lastDone) + 1).find((id) => v.steps[id].status === "pending") : "request";
  v.current = active ?? next;
}

export function publish(ctx: Ctx) {
  recompute(ctx.session.trip);
  ctx.emit({ type: "trip", trip: structuredClone(ctx.session.trip.view) });
}

/** Moves a step and tells the chat. `now` is the line the side panel shows on top. */
export function step(ctx: Ctx, id: StepId, status: StepStatus, summary?: string, now?: string) {
  const s = ctx.session.trip.view.steps[id];
  const t = Date.now();
  if (status === "running" || status === "waiting") {
    if (s.status !== "running" && s.status !== "waiting") s.startedAt = t;
    s.endedAt = undefined;
  } else if (status !== "pending") {
    s.startedAt ??= t;
    s.endedAt = t;
  } else {
    s.startedAt = s.endedAt = undefined;
  }
  s.status = status;
  s.error = status === "failed" ? summary : undefined;
  if (status !== "failed" && summary !== undefined) s.summary = summary;
  if (status === "pending") s.summary = undefined;
  ctx.session.trip.view.now = now ?? defaultNow(id, status, summary);
  publish(ctx);
}

function defaultNow(id: StepId, status: StepStatus, summary?: string) {
  const title = STEP_LABELS[id].title;
  if (status === "running") return `${title}…`;
  // The panel's eyebrow already says "Waiting for you".
  if (status === "waiting") return summary ?? STEP_LABELS[id].hint;
  if (status === "failed") return `${title} failed${summary ? ` · ${summary}` : ""}`;
  return summary ? `${title} · ${summary}` : title;
}

/** A new search or a new choice undoes what was built on the old one. */
export function resetFrom(ctx: Ctx, id: StepId) {
  const t = ctx.session.trip;
  const from = STEPS.indexOf(id);
  for (const s of STEPS.slice(from)) t.view.steps[s] = { status: "pending" };
  if (from <= STEPS.indexOf("choose")) t.chosenRef = undefined;
  if (from <= STEPS.indexOf("price")) t.priced = undefined;
  if (from <= STEPS.indexOf("seats")) {
    t.seatMaps = [];
    t.seats = [];
  }
  if (from <= STEPS.indexOf("extras")) {
    t.services = [];
    t.extras = [];
  }
  if (from <= STEPS.indexOf("review")) t.quote = undefined;
  if (from <= STEPS.indexOf("payment")) t.payment = undefined;
  if (from <= STEPS.indexOf("booking")) {
    t.order = undefined;
    t.idempotencyKey = undefined;
    t.view.pnr = undefined;
  }
}

const LABEL = { ADT: "Adult", CHD: "Child", INF: "Infant" } as const;

/** The traveller slots a search asked for, in the order the forms and the order use them. */
export function paxSlots(r: SearchRequest): PaxSlot[] {
  const out: PaxSlot[] = [];
  const add = (type: PaxSlot["type"], n = 0) => {
    for (let i = 1; i <= n; i++) out.push({ id: `PAX${out.length + 1}`, type, label: `${LABEL[type]} ${n > 1 ? i : ""}`.trim() });
  };
  add("ADT", r.adults);
  add("CHD", r.children);
  add("INF", r.infants);
  return out;
}

/** What the model is told about the trip on every turn: each step, and what the booking already has. */
export function tripBrief(t: TripState) {
  const v = t.view;
  const lines = STEPS.map((id, i) => {
    const s = v.steps[id];
    return `${String(i + 1).padStart(2, "0")} ${STEP_LABELS[id].title}: ${s.status}${s.summary ? ` — ${s.summary}` : ""}${s.error ? ` — ${s.error}` : ""}`;
  });
  const has = [
    t.chosenRef && `chosen offer ${t.chosenRef}`,
    t.priced && `priced ${t.priced.total_amount} ${t.priced.currency}, held until ${t.priced.price_guaranteed_until ?? "unknown"}`,
    t.pax.length && `travellers: ${t.pax.map((p) => `${p.id} ${p.type}`).join(", ")}`,
    t.travellers && `names given: ${t.travellers.passengers.map((p) => `${p.first_name} ${p.last_name[0]}.`).join(", ")}`,
    t.quote && `quote total ${t.quote.total} ${t.quote.currency}`,
    t.payment && `card ending ${t.payment.last4} approved for ${t.payment.amount} ${t.payment.currency}`,
    t.order && `order ${t.order.order_id}, booking reference ${t.order.pnr}, status ${t.order.status}`,
  ].filter(Boolean);
  return [`Current step: ${v.current ?? "none — the trip is complete"}.`, ...lines, has.length ? `Booking so far: ${has.join("; ")}.` : ""].join("\n");
}
