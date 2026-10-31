import "server-only";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, duration, money } from "@/lib/format";
import type { CabinClass, Offer, Order, SearchRequest } from "@/lib/types";
import { learnPlaces, offerCodes, placeLabel, rememberAirports, shortName } from "./agent/places";
import { remember, type Session } from "./agent/sessions";
import { digest } from "./agent/tools";
import { openCheckout, paidOrders, slotsFor } from "./checkout";
import { norba, NorbaError } from "./norba";

/*
 * Norba as the booking layer for any AI assistant: the tools an assistant gets over MCP (Model Context Protocol).
 * They search and price real airline offers and hand back a checkout link; the traveller books on that page with their
 * own details and card. No assistant ever holds a card number or a passport, and none can spend money on its own.
 */

type Args = Record<string, unknown>;

export type McpResult = { text: string; structured?: Record<string, unknown>; isError?: boolean };

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; openWorldHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run: (a: Args, ctx: McpContext) => Promise<McpResult>;
};

export type McpContext = { session: Session; baseUrl: string; signal?: AbortSignal };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d);
const quiet = { emit: () => {} };
const CABINS = ["economy", "premium_economy", "business", "first"];

function sliceSummary(s: Session, o: Offer) {
  return o.slices.map((x) => ({
    from: x.origin,
    from_name: s.places.get(x.origin) ?? null,
    to: x.destination,
    to_name: s.places.get(x.destination) ?? null,
    departs: x.departure_utc,
    arrives: x.arrival_utc,
    duration_minutes: x.duration_minutes,
    stops: x.stops,
    flights: x.segments.map((g) => g.flight_number).filter(Boolean),
  }));
}

function orderView(o: Order) {
  return {
    order_id: o.order_id,
    booking_reference: o.pnr ?? null,
    airline: airlineName(o.airline),
    status: o.status,
    environment: o.environment ?? null,
    total: o.total_amount ?? null,
    currency: o.currency ?? null,
    travellers: o.passengers?.length ?? 0,
    flights: (o.slices ?? []).map((x) => ({ from: x.origin, to: x.destination, departs: x.departure_utc, arrives: x.arrival_utc, flights: x.segments.map((g) => g.flight_number) })),
    tickets_issued: (o.tickets ?? []).filter((t) => t.status === "issued" && (t.type ?? "ticket") === "ticket").length,
  };
}

/** ", price held for 19 min": a duration reads the same in every time zone. */
const held = (until?: string) => {
  const min = until ? Math.floor((Date.parse(until) - Date.now()) / 60_000) : NaN;
  return min > 0 ? `, price held for ${min} min` : "";
};

function refused(e: unknown): McpResult {
  if (e instanceof NorbaError) return { text: `The airline or Norba refused: ${e.message}${e.code ? ` (${e.code})` : ""}`, isError: true };
  return { text: `Something failed: ${(e as Error)?.message ?? "unknown error"}`, isError: true };
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "find_airports",
    title: "Find airports",
    description: "Airports and city codes (IATA) for a place name, e.g. 'London' → LON (all airports), LHR, LGW. Use before search_flights when the traveller names a city.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "City, airport name or code" } }, required: ["query"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a, { session }) {
      try {
        const found = await norba().airports(str(a.query));
        rememberAirports({ session, ...quiet }, found);
        const airports = found.map((x) => ({ code: x.iata_code, name: shortName(x), city: x.city ?? null, country: x.country ?? null, all_airports: x.airport_type === "metropolitan_area" }));
        return { text: airports.length ? airports.map((x) => `${x.code} ${x.name}${x.all_airports ? " (all airports)" : ""}`).join("\n") : "No airport matches.", structured: { airports } };
      } catch (e) {
        return refused(e);
      }
    },
  },
  {
    name: "search_flights",
    title: "Search flights",
    description:
      "Live offers from the airlines Norba connects to (NDC, the airlines' own offers). Returns the best itineraries with a short ref each (o1, o2…) and prices for all travellers. To book one, call create_checkout with its ref.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "IATA airport or city code" },
        destination: { type: "string", description: "IATA airport or city code" },
        departure_date: { type: "string", description: "YYYY-MM-DD" },
        return_date: { type: "string", description: "YYYY-MM-DD for a round trip" },
        adults: { type: "integer", minimum: 1, maximum: 9, default: 1 },
        children: { type: "integer", minimum: 0, maximum: 8, default: 0 },
        infants: { type: "integer", minimum: 0, maximum: 4, default: 0 },
        cabin_class: { type: "string", enum: CABINS, default: "economy" },
        max_stops: { type: "integer", minimum: 0, maximum: 2, description: "0 for non-stop only" },
      },
      required: ["origin", "destination", "departure_date"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a, { session, signal }) {
      const req: SearchRequest = {
        origin: str(a.origin).toUpperCase(),
        destination: str(a.destination).toUpperCase(),
        departure_date: str(a.departure_date),
        return_date: str(a.return_date) || undefined,
        adults: int(a.adults, 1),
        children: int(a.children, 0) || undefined,
        infants: int(a.infants, 0) || undefined,
        cabin_class: CABINS.includes(str(a.cabin_class)) ? (str(a.cabin_class) as CabinClass) : undefined,
        max_stops: typeof a.max_stops === "number" ? a.max_stops : undefined,
      };
      try {
        const { offers } = await norba().search(req, () => {}, signal);
        const stored = remember(session, { kind: "offers", id: `mcp_${Date.now().toString(36)}`, title: "", request: req, offers, refs: {}, tags: {}, airlines: [], streaming: false });
        await learnPlaces({ session, ...quiet }, offerCodes(offers));
        const top = [...offers].sort((x, y) => x.total_amount - y.total_amount).slice(0, 12);
        return {
          text: digest(offers, stored.refs, false),
          structured: {
            offers: top.map((o) => ({
              ref: stored.refs[o.offer_id],
              airline: airlineName(o.airline),
              total: o.total_amount,
              currency: o.currency,
              fare: o.fare_family?.name ?? null,
              checked_bag_included: Boolean(o.baggage_included),
              slices: sliceSummary(session, o),
            })),
          },
        };
      } catch (e) {
        return refused(e);
      }
    },
  },
  {
    name: "price_calendar",
    title: "Price calendar",
    description: "The lowest price per day on a route over a range of dates (up to two months), for flexible travellers.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["origin", "destination", "from", "to"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a) {
      try {
        const r = await norba().calendar({ origin: str(a.origin).toUpperCase(), destination: str(a.destination).toUpperCase(), from: str(a.from), to: str(a.to) });
        const cheapest = [...r.days].sort((x, y) => x.amount - y.amount).slice(0, 5);
        return { text: cheapest.map((d) => `${dateLabel(d.date)}: from ${money(d.amount, r.currency)}`).join("\n") || "No prices on those dates.", structured: { currency: r.currency, days: r.days } };
      } catch (e) {
        return refused(e);
      }
    },
  },
  {
    name: "create_checkout",
    title: "Create a checkout link",
    description:
      "Confirms the price of an offer with the airline (it may change) and returns a checkout link. Give the link to the traveller: they enter names and card on that page and press Pay. You never collect card or passport details yourself.",
    inputSchema: { type: "object", properties: { ref: { type: "string", description: "The offer ref from search_flights, e.g. o3" } }, required: ["ref"], additionalProperties: false },
    annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false, idempotentHint: false },
    async run(a, { session, baseUrl }) {
      const ref = str(a.ref).toLowerCase();
      const offer = session.offers.get(ref);
      const search = session.searches.find((x) => Object.values(x.refs).includes(ref));
      if (!offer || !search) return { text: `There is no offer ${ref} from this session's searches; call search_flights first.`, isError: true };
      try {
        const priced = await norba().price(offer);
        const r = search.request;
        const c = await openCheckout(priced, slotsFor(r.adults, r.children, r.infants), "assistant");
        const url = `${baseUrl}/pay/${c.token}`;
        const moved = Math.abs(priced.total_amount - offer.total_amount) >= 0.01;
        return {
          text: `${airlineName(priced.airline)} confirmed ${money(c.total, c.currency, { cents: true })}${moved ? ` (search said ${money(offer.total_amount, offer.currency)})` : ""}${held(priced.price_guaranteed_until)}. Checkout: ${url}`,
          structured: { payment_url: url, total: c.total, currency: c.currency, price_held_until: priced.price_guaranteed_until ?? null, previous_total: offer.total_amount, slices: sliceSummary(session, priced) },
        };
      } catch (e) {
        return refused(e);
      }
    },
  },
  {
    name: "get_order",
    title: "Get an order",
    description: "Status, flights and tickets of a booking made through a checkout link, by booking reference or order id.",
    inputSchema: { type: "object", properties: { reference: { type: "string" } }, required: ["reference"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a, { session }) {
      const ref = str(a.reference).toUpperCase();
      const known = [...session.orders, ...paidOrders()].find((o) => o.pnr?.toUpperCase() === ref || o.order_id.toUpperCase() === ref);
      if (!known) return { text: `No booking ${ref} was made through this connection yet. If the traveller is still on the checkout page, it is not booked until they press Pay.`, isError: true };
      try {
        const o = await norba().getOrder(known.order_id, known.airline);
        const v = orderView(o);
        return {
          text: `${v.booking_reference ?? v.order_id} with ${v.airline}: ${v.status}, ${v.tickets_issued} e-ticket(s). ${(o.slices ?? []).map((x) => `${dateLabel(x.departure_utc.slice(0, 10))} ${clock(x.departure_utc)} ${placeLabel(session, x.origin)} → ${placeLabel(session, x.destination)} (${duration(x.duration_minutes)})`).join("; ")}`,
          structured: v,
        };
      } catch (e) {
        return refused(e);
      }
    },
  },
];
