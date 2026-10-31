import "server-only";

import type { Airport, CabinClass, FareFamily, Offer, OfferQuote, Order, PricedOffer, SearchRequest, Seat, SeatMap, Segment, Service, Slice } from "@/lib/types";
import { MOCK_AIRPORTS, MOCK_METROS, type MockAirport } from "./mock-airports";
import { NorbaError, type CalendarQuery, type ChosenExtra, type ChosenSeat, type NorbaPort, type OrderRequest, type ReshopQuery } from "./port";

/*
 * Mock mode: believable offers generated from the route and date, so the agent and the UI can be built and demoed
 * without a Norba key and without spending metered requests. The same search always gives the same flights.
 */

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function rng(seedText: string) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

function pointsFor(code: string): MockAirport[] {
  const c = code.toUpperCase();
  const own = MOCK_AIRPORTS.find((a) => a.iata === c);
  if (own) return [own];
  const metro = MOCK_AIRPORTS.filter((a) => a.metro === c);
  if (metro.length) return metro;
  throw new NorbaError(`${code} is not an airport the mock knows; add it to mock-airports.ts or set NORBA_API_KEY`, 400, "invalid_search");
}

function km(a: MockAirport, b: MockAirport) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const blockMinutes = (a: MockAirport, b: MockAirport) => Math.round((km(a, b) / 820) * 60 + 35);

/** An instant written in the airport's own offset, as Norba writes segment times. */
function local(ms: number, tz: number) {
  const d = new Date(ms + tz * 3_600_000);
  const sign = tz < 0 ? "-" : "+";
  const off = `${sign}${String(Math.abs(tz)).padStart(2, "0")}:00`;
  return `${d.toISOString().slice(0, 19)}${off}`;
}

/** `home`: countries where the carrier also flies point to point, beyond its hubs. */
type Carrier = { code: string; hubs: string[]; home: string[]; reach: (o: MockAirport, d: MockAirport) => boolean };

const EU = new Set(["ES", "PT", "GB", "IE", "FR", "NL", "BE", "DE", "CH", "AT", "IT", "GR", "CY", "TR", "IL", "EG", "MA", "AE"]);
const AMERICAS = new Set(["US", "CA", "MX", "CO", "PE", "BR", "AR", "CL"]);
const touches = (set: Set<string>, o: MockAirport, d: MockAirport) => set.has(o.country) || set.has(d.country);

const CARRIERS: Carrier[] = [
  { code: "AA", hubs: ["JFK", "PHL", "CLT", "DFW", "MIA", "ORD"], home: ["US"], reach: (o, d) => touches(AMERICAS, o, d) },
  { code: "A3", hubs: ["ATH", "SKG"], home: ["GR", "CY"], reach: (o, d) => EU.has(o.country) && EU.has(d.country) },
  { code: "AF", hubs: ["CDG"], home: ["FR"], reach: () => true },
  { code: "KL", hubs: ["AMS"], home: ["NL"], reach: () => true },
];

const FAMILIES: { name: string; mult: number; bag: boolean; refundable: boolean; changeable: boolean }[] = [
  { name: "Basic", mult: 1, bag: false, refundable: false, changeable: false },
  { name: "Classic", mult: 1.28, bag: true, refundable: false, changeable: true },
  { name: "Flex", mult: 1.85, bag: true, refundable: true, changeable: true },
];

const CABIN_MULT: Record<CabinClass, number> = { economy: 1, premium_economy: 1.7, business: 3.6, first: 6 };

function family(f: (typeof FAMILIES)[number]): FareFamily {
  return {
    name: f.name,
    benefits: [
      { type: "carry_on", included: true, value: "8kg" },
      { type: "checked_bag", included: f.bag, value: f.bag ? "23kg" : undefined },
      { type: "seat_selection", included: f.name !== "Basic" },
      { type: "changes", included: f.changeable },
      { type: "refund", included: f.refundable },
    ],
  };
}

function buildSlice(rand: () => number, carrier: Carrier, o: MockAirport, d: MockAirport, date: string, via?: MockAirport, cabin: CabinClass = "economy"): Slice {
  const hour = 6 + Math.floor(rand() * 16);
  const minute = [0, 10, 25, 35, 45, 50][Math.floor(rand() * 6)];
  const depMs = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`) - o.tz * 3_600_000;
  const hops = via ? [o, via, d] : [o, d];
  const segments: Segment[] = [];
  let t = depMs;
  for (let i = 0; i < hops.length - 1; i++) {
    const a = hops[i];
    const b = hops[i + 1];
    const mins = blockMinutes(a, b);
    if (i > 0) t += (55 + Math.floor(rand() * 150)) * 60_000;
    const arr = t + mins * 60_000;
    segments.push({
      segment_id: `seg-${a.iata}${b.iata}-${t}`,
      origin: a.iata,
      destination: b.iata,
      departure_utc: local(t, a.tz),
      arrival_utc: local(arr, b.tz),
      flight_number: `${carrier.code}${100 + Math.floor(rand() * 8800)}`,
      marketing_carrier: carrier.code,
      operating_carrier: carrier.code,
      aircraft: km(a, b) > 4000 ? ["789", "77W", "333"][Math.floor(rand() * 3)] : ["320", "321", "32N", "E95"][Math.floor(rand() * 4)],
      duration_minutes: mins,
      cabin_class: cabin,
      booking_class: cabin === "business" ? "J" : "Y",
    });
    t = arr;
  }
  return {
    origin: o.iata,
    destination: d.iata,
    departure_utc: segments[0].departure_utc,
    arrival_utc: segments.at(-1)!.arrival_utc,
    duration_minutes: Math.round((t - depMs) / 60_000),
    stops: segments.length - 1,
    segments,
  };
}

function generate(req: SearchRequest): Map<string, Offer[]> {
  const legs = req.legs?.length
    ? req.legs
    : [
        { origin: req.origin!, destination: req.destination!, departure_date: req.departure_date! },
        ...(req.return_date ? [{ origin: req.destination!, destination: req.origin!, departure_date: req.return_date }] : []),
      ];
  const rand = rng(JSON.stringify(req));
  const cabin = req.cabin_class ?? "economy";
  const pax = req.adults + (req.children ?? 0) * 0.8 + (req.infants ?? 0) * 0.12;
  const currency = req.currency ?? "EUR";
  const firstO = pointsFor(legs[0].origin)[0];
  const firstD = pointsFor(legs[0].destination)[0];
  const byCarrier = new Map<string, Offer[]>();

  for (const carrier of CARRIERS) {
    if (!carrier.reach(firstO, firstD)) continue;
    const routings: (string | undefined)[] = [];
    // Non-stop only where the airline really could: from or to its hubs or its home country.
    const ends = [firstO, firstD];
    if (ends.some((a) => carrier.hubs.includes(a.iata) || carrier.home.includes(a.country))) routings.push(undefined);
    for (const h of carrier.hubs) if (h !== firstO.iata && h !== firstD.iata && rand() < 0.6) routings.push(h);
    if (!routings.length) continue;
    const offers: Offer[] = [];
    for (const via of routings.slice(0, 3)) {
      const times = 1 + Math.floor(rand() * 2);
      for (let k = 0; k < times; k++) {
        const slices = legs.map((l) => {
          const os = pointsFor(l.origin);
          const ds = pointsFor(l.destination);
          const o = os[Math.floor(rand() * os.length)];
          const d = ds[Math.floor(rand() * ds.length)];
          const hub = via ? MOCK_AIRPORTS.find((a) => a.iata === via) : undefined;
          return buildSlice(rand, carrier, o, d, l.departure_date, hub && hub.iata !== o.iata && hub.iata !== d.iata ? hub : undefined, cabin);
        });
        const distance = legs.reduce((a, l) => a + km(pointsFor(l.origin)[0], pointsFor(l.destination)[0]), 0);
        const base = (45 + distance * 0.075) * CABIN_MULT[cabin] * (via ? 0.86 : 1.12) * (0.82 + rand() * 0.5);
        for (const f of FAMILIES.slice(0, cabin === "economy" ? 3 : 2)) {
          const fare = Math.round(base * f.mult * pax);
          const taxes = Math.round((38 + distance * 0.012) * pax);
          const id = `${carrier.code}-MOCK${Math.floor(rand() * 1e9).toString(36).toUpperCase()}-${f.name.toUpperCase()}`;
          offers.push({
            offer_id: id,
            airline: carrier.code,
            currency,
            base_fare: fare,
            taxes_fees: taxes,
            total_amount: fare + taxes,
            expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
            slices,
            passengers: [
              { type: "ADT", count: req.adults },
              ...(req.children ? [{ type: "CHD" as const, count: req.children }] : []),
              ...(req.infants ? [{ type: "INF" as const, count: req.infants }] : []),
            ],
            baggage_included: f.bag,
            ancillaries_included: [
              { type: "bag_carry_on", name: "Cabin bag", included_in_fare: true, weight_kg: 8 },
              { type: "bag_checked", name: "Checked bag", included_in_fare: f.bag, weight_kg: 23 },
            ],
            fare_family: family(f),
            fare_rules: { refundable: f.refundable, changeable: f.changeable, change_penalty_amount: f.changeable && f.name !== "Flex" ? 70 : 0, change_penalty_currency: currency },
            cabin_class: cabin,
          });
        }
      }
    }
    byCarrier.set(carrier.code, offers);
  }
  return byCarrier;
}

function validate(req: SearchRequest) {
  const today = new Date().toISOString().slice(0, 10);
  const dates = req.legs?.map((l) => l.departure_date) ?? [req.departure_date, req.return_date].filter(Boolean);
  if (!req.legs && (!req.origin || !req.destination || !req.departure_date)) throw new NorbaError("origin, destination and departure_date are required", 400, "invalid_search");
  if (!req.legs && req.origin === req.destination) throw new NorbaError("origin and destination must differ", 400, "same_airport");
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d!)) throw new NorbaError(`${d} is not YYYY-MM-DD`, 400, "invalid_date");
    if (d! < today) throw new NorbaError("departure_date must not be in the past", 400, "date_out_of_range");
  }
  if (req.return_date && req.departure_date && req.return_date < req.departure_date) throw new NorbaError("return_date is before departure_date", 400, "return_before_departure");
  if (req.adults + (req.children ?? 0) + (req.infants ?? 0) > 9) throw new NorbaError("at most 9 passengers", 400, "too_many_passengers");
  if ((req.infants ?? 0) > req.adults) throw new NorbaError("infants exceed adults", 400, "infants_exceed_adults");
}

// ── Seats, extras and orders ─────────────────────────────────────────────────

/** What the mock served, so a quote or an order prices only what was offered — as Norba does. */
/** The mock airline's memory, shared by API routes and pages (Next.js may load this module more than once). */
type MockState = {
  priced: Map<string, PricedOffer>;
  seatMaps: Map<string, SeatMap>;
  serviceLists: Map<string, Service[]>;
  orders: Map<string, Order>;
  ordersById: Map<string, Order>;
  /** Reshop offers handed out, so a change can find what it accepts. */
  reshopped: Map<string, { orderId: string; sliceIndex: number; offer: Offer }>;
  /** Flights the airline cancelled, as `${order_id}|${sliceIndex}`: a rebooking off them costs nothing. */
  disrupted: Set<string>;
};
const mockStore = globalThis as unknown as { __naMock?: MockState };
const state: MockState = (mockStore.__naMock ??= {
  priced: new Map(),
  seatMaps: new Map(),
  serviceLists: new Map(),
  orders: new Map(),
  ordersById: new Map(),
  reshopped: new Map(),
  disrupted: new Set(),
});
const { priced, seatMaps, serviceLists, orders, ordersById, reshopped, disrupted } = state;

const shiftClock = (iso: string, minutes: number) => {
  const tz = iso.slice(19);
  const d = new Date(Date.parse(iso) + minutes * 60_000 + (tz ? Number(tz.slice(0, 3)) * 3_600_000 : 0));
  return `${d.toISOString().slice(0, 19)}${tz}`;
};

/**
 * The airline acts on a booked flight, for demos of what the agent does next: `cancelled` drops the flight from
 * the schedule; `retimed` moves it by `minutes`, which is what a schedule change notice reports.
 */
export function mockDisrupt(orderId: string, sliceIndex: number, kind: "cancelled" | "retimed", minutes = 0) {
  const order = ordersById.get(orderId);
  const slice = order?.slices?.[sliceIndex];
  if (!order || !slice) throw new NorbaError(`no mock order ${orderId} with flight ${sliceIndex + 1}`, 404, "order_not_found");
  const before = structuredClone(slice);
  disrupted.add(`${orderId}|${sliceIndex}`);
  if (kind === "retimed") {
    const moved: Slice = {
      ...slice,
      departure_utc: shiftClock(slice.departure_utc, minutes),
      arrival_utc: shiftClock(slice.arrival_utc, minutes),
      segments: slice.segments.map((g) => ({ ...g, departure_utc: shiftClock(g.departure_utc, minutes), arrival_utc: shiftClock(g.arrival_utc, minutes) })),
    };
    order.slices = order.slices!.map((x, i) => (i === sliceIndex ? moved : x));
  }
  return { order, before, after: order.slices![sliceIndex] };
}

/** Ticket stock prefixes of the mock's airlines. */
const STOCK: Record<string, string> = { AA: "001", A3: "390", OA: "050", AF: "057", KL: "074" };

function mockSeatMap(offer: PricedOffer, segment: Segment): SeatMap {
  const rand = rng(`${offer.offer_id}${segment.segment_id}`);
  const wide = ["789", "77W", "333"].includes(segment.aircraft ?? "");
  const columns = wide ? ["A", "C", "D", "E", "F", "G", "H", "K"] : ["A", "B", "C", "D", "E", "F"];
  const business = offer.cabin_class === "business" || offer.cabin_class === "first";
  const rows = business ? [1, 2, 3, 4, 5, 6] : Array.from({ length: wide ? 22 : 18 }, (_, i) => i + (wide ? 20 : 8));
  const seats: Seat[] = [];
  for (const row of rows) {
    for (const column of business ? columns.filter((_, i) => i % 2 === 0) : columns) {
      const exit = !business && (row === rows[0] + 4 || row === rows[0] + 5);
      const front = row - rows[0] < 3;
      const aisle = wide ? ["C", "D", "G", "H"].includes(column) : ["C", "D"].includes(column);
      const window = column === columns[0] || column === columns.at(-1);
      const base = business ? 0 : exit ? 38 : front ? 22 : window || aisle ? 12 : 8;
      seats.push({
        seat_id: `${segment.segment_id}-${row}${column}`,
        row,
        column,
        cabin: business ? "business" : "economy",
        available: rand() > 0.32,
        price: { amount: base, currency: offer.currency },
        features: [...(window ? ["window"] : []), ...(aisle ? ["aisle"] : []), ...(exit ? ["exit_row", "extra_legroom"] : [])],
        segment_id: segment.segment_id!,
      });
    }
  }
  return { flight_id: segment.flight_number, airline: offer.airline, aircraft: segment.aircraft, rows: rows.length, seats };
}

function mockServices(offer: PricedOffer): Service[] {
  const segs = offer.slices.flatMap((s) => s.segments.map((g) => g.segment_id!));
  const c = offer.currency;
  const perSlice = offer.slices.map((s) => s.segments.map((g) => g.segment_id!));
  const list: Service[] = [];
  perSlice.forEach((ids, i) => {
    const dir = offer.slices.length > 1 ? (i ? " · return" : " · outbound") : "";
    if (!offer.baggage_included) list.push({ service_id: `${offer.offer_id}-BAG23-${i}`, type: "bag_checked", name: `Checked bag 23 kg${dir}`, price: { amount: 38, currency: c }, segment_refs: ids });
    list.push({ service_id: `${offer.offer_id}-BAG32-${i}`, type: "bag_checked", name: `Heavy bag 32 kg${dir}`, price: { amount: 65, currency: c }, segment_refs: ids });
    list.push({ service_id: `${offer.offer_id}-PRIO-${i}`, type: "priority_boarding", name: `Priority boarding${dir}`, price: { amount: 12, currency: c }, segment_refs: ids });
  });
  list.push({ service_id: `${offer.offer_id}-MEAL`, type: "meal", name: "Hot meal on every flight", price: { amount: 18, currency: c }, segment_refs: segs });
  list.push({ service_id: `${offer.offer_id}-SPORT`, type: "sport_equipment", name: "Bike or skis", price: { amount: 70, currency: c }, segment_refs: segs });
  return list;
}

function mockQuote(offer: PricedOffer, seats: ChosenSeat[], extras: ChosenExtra[]): OfferQuote {
  let extrasTotal = 0;
  for (const s of seats) {
    const map = seatMaps.get(`${offer.offer_id}|${s.segment_id}`);
    const seat = map?.seats.find((x) => x.row === s.row && x.column === s.column);
    if (!seat) throw new NorbaError(`seat ${s.row}${s.column} is not on the map served for this offer`, 422, "extra_not_priced");
    extrasTotal += seat.price?.amount ?? 0;
  }
  const list = serviceLists.get(offer.offer_id) ?? [];
  for (const e of extras) {
    const svc = list.find((x) => x.service_id === e.ancillary_offer_id);
    if (!svc) throw new NorbaError(`extra ${e.ancillary_offer_id} was not served for this offer`, 422, "extra_not_priced");
    extrasTotal += svc.price?.amount ?? 0;
  }
  const fareTotal = offer.total_amount;
  return { currency: offer.currency, base_fare: offer.base_fare, taxes_fees: offer.taxes_fees, fare_total: fareTotal, extras: extrasTotal, service_fee: 0, total: Math.round((fareTotal + extrasTotal) * 100) / 100 };
}

const luhn = (n: string) =>
  n
    .split("")
    .reverse()
    .reduce((a, d, i) => a + (i % 2 ? ((Number(d) * 2) % 10) + Math.floor((Number(d) * 2) / 10) : Number(d)), 0) %
    10 ===
  0;

export const mockNorba: NorbaPort = {
  async search(req, onBatch, signal) {
    validate(req);
    let all = [...generate(req).entries()];
    if (req.max_stops != null) all = all.map(([c, offers]) => [c, offers.filter((o) => o.slices.every((s) => s.stops <= req.max_stops!))]);
    const out: Offer[] = [];
    const rand = rng(`delay${JSON.stringify(req)}`);
    for (const [, offers] of all) {
      await sleep(500 + rand() * 1400, signal);
      if (offers.length) {
        out.push(...offers);
        onBatch(offers);
      }
    }
    out.sort((a, b) => a.total_amount - b.total_amount);
    return {
      searchId: `srch_mock_${Date.now().toString(36)}`,
      offers: out,
      meta: { total: out.length, airlines: [...new Set(out.map((o) => o.airline))], min_price: out[0]?.total_amount },
      expiresAt: new Date(Date.now() + 25 * 60_000).toISOString(),
    };
  },

  async price(offer: Offer): Promise<PricedOffer> {
    await sleep(900);
    const rand = rng(offer.offer_id);
    // Now and then the airline reprices, as a real OfferPrice can.
    const delta = rand() < 0.25 ? Math.round(offer.total_amount * 0.04) : 0;
    const result: PricedOffer = {
      ...offer,
      offer_id: `${offer.offer_id}-P`,
      total_amount: offer.total_amount + delta,
      taxes_fees: (offer.taxes_fees ?? 0) + delta,
      price_guaranteed_until: new Date(Date.now() + 20 * 60_000).toISOString(),
    };
    priced.set(result.offer_id, result);
    return result;
  },

  async calendar(q: CalendarQuery) {
    const o = pointsFor(q.origin)[0];
    const d = pointsFor(q.destination)[0];
    const base = (45 + km(o, d) * 0.075) * 1.1 + 40;
    const days = [];
    const start = Date.parse(`${q.from}T00:00:00Z`);
    const end = Math.min(Date.parse(`${q.to}T00:00:00Z`), start + 62 * 86_400_000);
    for (let t = start; t <= end; t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      const dow = new Date(t).getUTCDay();
      const r = rng(`${q.origin}${q.destination}${date}`)();
      if (r < 0.12) continue;
      const weekend = dow === 5 || dow === 0 ? 1.22 : dow === 2 || dow === 3 ? 0.88 : 1;
      days.push({ date, amount: Math.round(base * weekend * (0.8 + r * 0.5)) });
    }
    return { currency: q.currency ?? "EUR", days };
  },

  async airports(query: string): Promise<Airport[]> {
    const q = fold(query);
    if (!q) return [];
    const up = query.trim().toUpperCase();
    const out: Airport[] = [];
    if (MOCK_METROS[up]) out.push({ iata_code: up, name: MOCK_METROS[up], city: MOCK_AIRPORTS.find((a) => a.metro === up)?.city, airport_type: "metropolitan_area" });
    const hits = MOCK_AIRPORTS.filter(
      (a) => a.iata === up || fold(a.city).startsWith(q) || fold(a.name).includes(q) || a.aka?.some((k) => k.startsWith(q) || q === k),
    );
    const metros = new Set(hits.map((a) => a.metro).filter(Boolean) as string[]);
    for (const m of metros) if (!out.some((a) => a.iata_code === m)) out.push({ iata_code: m, name: MOCK_METROS[m], city: hits.find((a) => a.metro === m)?.city, airport_type: "metropolitan_area" });
    for (const a of hits) out.push({ iata_code: a.iata, name: a.name, city: a.city, country: a.country, metro_code: a.metro, airport_type: "large_airport" });
    return out.slice(0, 8);
  },

  async airportsByCode(codes: string[]) {
    const out: Airport[] = [];
    for (const c of codes) {
      const a = MOCK_AIRPORTS.find((x) => x.iata === c);
      if (a) out.push({ iata_code: a.iata, name: a.name, city: a.city, country: a.country, metro_code: a.metro, airport_type: "large_airport" });
      else if (MOCK_METROS[c]) out.push({ iata_code: c, name: MOCK_METROS[c], city: MOCK_AIRPORTS.find((x) => x.metro === c)?.city, airport_type: "metropolitan_area" });
    }
    return out;
  },

  async seatMap(offer, segmentId) {
    await sleep(500);
    const segment = offer.slices.flatMap((s) => s.segments).find((g) => g.segment_id === segmentId);
    if (!segment) return null;
    const map = mockSeatMap(offer, segment);
    seatMaps.set(`${offer.offer_id}|${segmentId}`, map);
    return map;
  },

  async services(offer) {
    await sleep(600);
    const list = mockServices(offer);
    serviceLists.set(offer.offer_id, list);
    return list;
  },

  async quote(offer, seats, extras) {
    await sleep(300);
    if (!priced.has(offer.offer_id)) throw new NorbaError("the offer has not been priced through this API", 404, "offer_not_found");
    return mockQuote(offer, seats, extras);
  },

  async createOrder(req: OrderRequest, idempotencyKey: string) {
    const replay = orders.get(idempotencyKey);
    if (replay) return { order: replay, outcomeUnknown: false };
    await sleep(2600);
    const number = req.payment.card.number;
    if (!/^\d{12,19}$/.test(number) || !luhn(number)) throw new NorbaError("card number is not valid", 400, "invalid_card");
    // The usual test card for a refusal, so the failure path can be shown too.
    if (number === "4000000000000002") throw new NorbaError("The airline declined the card.", 422, "airline_refused");
    const quote = mockQuote(req.offer, req.seats, req.extras);
    if (req.payment.amount + 0.01 < quote.total) throw new NorbaError(`payment.amount is less than the airline's price ${quote.total}`, 400);
    const rand = rng(idempotencyKey);
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const pnr = Array.from({ length: 6 }, () => letters[Math.floor(rand() * letters.length)]).join("");
    const stock = STOCK[req.offer.airline] ?? "999";
    const order: Order = {
      order_id: `ORD-MOCK-${pnr}`,
      airline: req.offer.airline,
      pnr,
      status: "ticketed",
      environment: "sandbox",
      currency: quote.currency,
      total_amount: quote.total,
      passengers: req.passengers.map((p) => ({ ...p, document: undefined })),
      slices: req.offer.slices,
      tickets: req.passengers.map((p) => ({ passenger_id: p.id, ticket_number: `${stock}-${String(Math.floor(rand() * 1e10)).padStart(10, "0")}`, status: "issued", type: "ticket" })),
    };
    orders.set(idempotencyKey, order);
    ordersById.set(order.order_id, order);
    return { order, outcomeUnknown: false };
  },

  async networkAirlines() {
    return [
      { airline: "A3", name: "Aegean Airlines", carriers: ["A3", "OA"] },
      { airline: "AA", name: "American Airlines", carriers: ["AA", "MQ", "PT", "OH"] },
      { airline: "AF", name: "Air France", carriers: ["AF"] },
      { airline: "KL", name: "KLM", carriers: ["KL"] },
    ];
  },

  async getOrder(orderId) {
    const order = ordersById.get(orderId);
    if (!order) throw new NorbaError("order not found", 404, "order_not_found");
    return order;
  },

  async reshop(order, q: ReshopQuery) {
    await sleep(1400);
    const slice = order.slices?.[q.sliceIndex];
    if (!slice) throw new NorbaError("the order has no such flight", 400, "invalid_request");
    const adults = Math.max(1, order.passengers?.length ?? 1);
    const date = q.date ?? slice.departure_utc.slice(0, 10);
    const all = [...generate({ origin: slice.origin, destination: slice.destination, departure_date: date, adults }).values()].flat();
    const own = all.filter((o) => o.airline === order.airline);
    const flightOf = (x: Slice) => x.segments.map((g) => g.flight_number).join("+");
    const was = flightOf(slice);
    const free = disrupted.has(`${order.order_id}|${q.sliceIndex}`);
    const share = (order.total_amount ?? 0) / Math.max(1, order.slices?.length ?? 1);
    // One fare per flight, the cheapest: a rebooking keeps the fare the traveller already holds.
    const byFlight = new Map<string, Offer>();
    for (const o of own.length ? own : all) {
      const key = flightOf(o.slices[0]);
      if (key === was) continue;
      if (!byFlight.has(key) || byFlight.get(key)!.total_amount > o.total_amount) byFlight.set(key, o);
    }
    return [...byFlight.values()]
      .sort((a, b) => Date.parse(a.slices[0].departure_utc) - Date.parse(b.slices[0].departure_utc))
      .slice(0, 5)
      .map((o, i) => {
        const offer: Offer = {
          ...o,
          offer_id: `RS-${order.order_id}-${q.sliceIndex}-${i}`,
          total_amount: free ? 0 : Math.max(0, Math.round(o.total_amount - share)),
          currency: order.currency ?? o.currency,
        };
        reshopped.set(offer.offer_id, { orderId: order.order_id, sliceIndex: q.sliceIndex, offer });
        return offer;
      });
  },

  async changeOrder(order, offerId, idempotencyKey, payment) {
    const replay = orders.get(idempotencyKey);
    if (replay) return { order: replay, outcomeUnknown: false };
    const hit = reshopped.get(offerId);
    if (!hit || hit.orderId !== order.order_id) throw new NorbaError("that alternative is not on offer for this order any more", 409, "offer_expired");
    if (hit.offer.total_amount > 0 && !payment) throw new NorbaError(`the change costs ${hit.offer.total_amount} ${hit.offer.currency}: a payment is needed`, 400, "payment_required_for_change");
    await sleep(2200);
    const current = ordersById.get(order.order_id) ?? order;
    const rand = rng(idempotencyKey);
    const stock = STOCK[current.airline] ?? "999";
    const next: Order = {
      ...current,
      status: "ticketed",
      total_amount: (current.total_amount ?? 0) + hit.offer.total_amount,
      slices: current.slices!.map((x, i) => (i === hit.sliceIndex ? hit.offer.slices[0] : x)),
      tickets: [
        ...(current.tickets ?? []).map((t) => ({ ...t, status: t.status === "issued" ? "exchanged" : t.status })),
        ...(current.passengers ?? []).map((p) => ({ passenger_id: p.id, ticket_number: `${stock}-${String(Math.floor(rand() * 1e10)).padStart(10, "0")}`, status: "issued", type: "ticket" })),
      ],
    };
    disrupted.delete(`${current.order_id}|${hit.sliceIndex}`);
    ordersById.set(next.order_id, next);
    orders.set(idempotencyKey, next);
    return { order: next, outcomeUnknown: false };
  },
};
