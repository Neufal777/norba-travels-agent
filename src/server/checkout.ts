import "server-only";

import type { Contact, Order, Passenger, PaxSlot, PricedOffer } from "@/lib/types";
import { norba, NorbaError } from "./norba";
import type { CardData } from "./norba/port";

/*
 * A checkout link: a priced flight waiting for its travellers to fill in their names and card and press Pay. Any AI
 * assistant (through MCP), a group trip or an agency can hand one out; none of them ever sees the travellers' details
 * or the card. The booking runs when the person presses Pay on the page, as in the chat.
 */

export type CheckoutSource = "assistant" | "group" | "agency";

export type Checkout = {
  token: string;
  offer: PricedOffer;
  slots: PaxSlot[];
  total: number;
  currency: string;
  source: CheckoutSource;
  /** Who it is for, shown on the page ("Tom's flight"). */
  label?: string;
  createdAt: number;
  idempotencyKey: string;
  paying?: boolean;
  order?: Order;
  outcomeUnknown?: boolean;
};

const TTL_MS = 6 * 60 * 60_000;
const store = globalThis as unknown as { __naCheckouts?: Map<string, Checkout>; __naCheckoutListeners?: Map<string, ((c: Checkout) => void)[]> };
const checkouts = (store.__naCheckouts ??= new Map<string, Checkout>());
const listeners = (store.__naCheckoutListeners ??= new Map<string, ((c: Checkout) => void)[]>());

function sweep() {
  const now = Date.now();
  for (const [k, c] of checkouts) if (now - c.createdAt > TTL_MS) checkouts.delete(k);
}

const token = () => crypto.randomUUID().replace(/-/g, "").slice(0, 24);

/** Pax slots for a party: adults first, then children and infants, as an offer's passenger counts say. The ids are the
 * airline's own (T1, T2…, as in "…|T1:ADT,T2:ADT,T3:CHD"): an order with other passenger ids is refused (airline_refused). */
export function slotsFor(adults: number, children = 0, infants = 0): PaxSlot[] {
  const out: PaxSlot[] = [];
  for (let i = 0; i < adults; i++) out.push({ id: `T${out.length + 1}`, type: "ADT", label: `Adult ${i + 1}` });
  for (let i = 0; i < children; i++) out.push({ id: `T${out.length + 1}`, type: "CHD", label: `Child ${i + 1}` });
  for (let i = 0; i < infants; i++) out.push({ id: `T${out.length + 1}`, type: "INF", label: `Infant ${i + 1}` });
  return out;
}

/** Opens a checkout for a flight the airline has just priced, with the exact total the airline will charge. */
export async function openCheckout(offer: PricedOffer, slots: PaxSlot[], source: CheckoutSource, label?: string): Promise<Checkout> {
  sweep();
  const quote = await norba().quote(offer, [], []);
  const c: Checkout = { token: token(), offer, slots, total: quote.total, currency: quote.currency, source, label, createdAt: Date.now(), idempotencyKey: crypto.randomUUID() };
  checkouts.set(c.token, c);
  return c;
}

export const getCheckout = (t: string) => (/^[a-f0-9]{24}$/.test(t) ? checkouts.get(t) : undefined);

/** Calls `fn` once the checkout is paid. */
export function onPaid(t: string, fn: (c: Checkout) => void) {
  listeners.set(t, [...(listeners.get(t) ?? []), fn]);
}

export const holdEnded = (c: Checkout) => Boolean(c.offer.price_guaranteed_until && Date.parse(c.offer.price_guaranteed_until) < Date.now());

/** The person on the page pressed Pay. The card lives for this request only. */
export async function payCheckout(c: Checkout, passengers: Passenger[], contact: Contact, card: CardData, locale: "en" | "es") {
  if (c.order) return { order: c.order, outcomeUnknown: Boolean(c.outcomeUnknown) };
  if (c.paying) throw new NorbaError("This booking is already being made.", 409, "in_progress");
  if (holdEnded(c)) throw new NorbaError("The airline's price hold has ended. Ask for a new link.", 409, "offer_not_priced");
  c.paying = true;
  try {
    const r = await norba().createOrder({ offer: c.offer, passengers, contact, seats: [], extras: [], payment: { amount: c.total, currency: c.currency, card }, locale }, c.idempotencyKey);
    c.order = r.order;
    c.outcomeUnknown = r.outcomeUnknown;
    for (const fn of listeners.get(c.token) ?? []) {
      try {
        fn(c);
      } catch {}
    }
    listeners.delete(c.token);
    return r;
  } catch (e) {
    // A definite refusal charged nothing: another card may try under a new key.
    if (!(e instanceof NorbaError && (e.code?.endsWith("_outcome_unknown") || e.status === 502))) c.idempotencyKey = crypto.randomUUID();
    throw e;
  } finally {
    c.paying = false;
  }
}

/** Every checkout paid, for order lookups by assistants: the order and who it was for. */
export const paidOrders = () => [...checkouts.values()].filter((c) => c.order).map((c) => c.order!);
