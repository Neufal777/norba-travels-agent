import "server-only";

import type { Airport, Offer, OfferQuote, Order, PricedOffer, SearchRequest, SeatMap, Service } from "@/lib/types";
import { config } from "../config";
import { NorbaError, type CalendarQuery, type NorbaPort, type OrderRequest, type ReshopQuery, type SearchResult } from "./port";

const SEARCH_TIMEOUT_MS = 90_000;
/** A booking waits for the airline to create the order, take the payment and issue the tickets. */
const ORDER_TIMEOUT_MS = 150_000;
const CALL_TIMEOUT_MS = 30_000;

async function refusal(res: Response): Promise<NorbaError> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: string; message?: string; code?: string; reason?: string };
    return new NorbaError(body.error || body.message || `Norba answered ${res.status}`, res.status, body.code || body.reason);
  } catch {
    return new NorbaError(text.slice(0, 200) || `Norba answered ${res.status}`, res.status);
  }
}

async function call<T>(path: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  const res = await fetch(`${config.norba.baseUrl}${path}`, {
    ...init,
    headers: { "X-API-Key": config.norba.apiKey, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(init.timeout ?? CALL_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw await refusal(res);
  return (await res.json()) as T;
}

const byPrice = (a: Offer, b: Offer) => a.total_amount - b.total_amount;

/** Reads `event:` / `data:` frames off a Server-Sent Events body. */
async function* sseFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.search(/\r?\n\r?\n/)) >= 0) {
      const raw = buf.slice(0, cut);
      buf = buf.slice(cut).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      const data: string[] = [];
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) yield { event, data: data.join("\n") };
    }
  }
}

/** A production key books for real: refused unless ALLOW_PRODUCTION_BOOKINGS says otherwise. */
function refuseProductionWrites() {
  if (config.norba.apiKey.startsWith("nbr_live_") && !config.allowProductionBookings) {
    throw new NorbaError("Real bookings are switched off in this demo (it runs on a production Norba key without ALLOW_PRODUCTION_BOOKINGS).", 403, "production_bookings_off");
  }
}

export const liveNorba: NorbaPort = {
  async search(req: SearchRequest, onBatch, signal) {
    const res = await fetch(`${config.norba.baseUrl}/v1/shopping/offers/stream`, {
      method: "POST",
      headers: { "X-API-Key": config.norba.apiKey, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(req),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(SEARCH_TIMEOUT_MS)]) : AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok || !res.body) throw await refusal(res);

    // Batches can repeat an offer: the stream contract says to deduplicate on offer_id.
    const seen = new Map<string, Offer>();
    let searchId = "";
    let expiresAt: string | undefined;
    for await (const f of sseFrames(res.body)) {
      const data = JSON.parse(f.data);
      if (f.event === "search") {
        searchId = data.search_id;
        expiresAt = data.expires_at;
      } else if (f.event === "offers") {
        const fresh = ((data.offers ?? []) as Offer[]).filter((o) => !seen.has(o.offer_id));
        fresh.forEach((o) => seen.set(o.offer_id, o));
        if (fresh.length) onBatch(fresh);
      } else if (f.event === "done") {
        expiresAt = data.expires_at ?? expiresAt;
      } else if (f.event === "error") {
        throw new NorbaError(data.error || "The search failed", 502, data.code);
      }
    }
    const offers = [...seen.values()].sort(byPrice);
    const result: SearchResult = {
      searchId,
      offers,
      expiresAt,
      meta: { total: offers.length, airlines: [...new Set(offers.map((o) => o.airline))], min_price: offers[0]?.total_amount },
    };
    return result;
  },

  async price(offer: Offer) {
    return call<PricedOffer>("/v1/offers/price", { method: "POST", body: JSON.stringify({ offer_ids: [offer.offer_id], airline: offer.airline }) });
  },

  async calendar(q: CalendarQuery) {
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== "") as [string, string][]);
    const r = await call<{ currency: string; days: { date: string; amount: number }[] | null }>(`/v1/shopping/calendar?${params}`);
    return { currency: r.currency, days: r.days ?? [] };
  },

  async airports(query: string) {
    const params = new URLSearchParams({ q: query, commercial: "true", limit: "8" });
    const r = await call<{ data: Airport[] | null }>(`/v1/aviation/airports?${params}`);
    return r.data ?? [];
  },

  async airportsByCode(codes: string[]) {
    if (!codes.length) return [];
    const params = new URLSearchParams({ iata: codes.join(","), limit: String(Math.min(100, codes.length * 2)) });
    const r = await call<{ data: Airport[] | null }>(`/v1/aviation/airports?${params}`);
    return r.data ?? [];
  },

  async networkAirlines() {
    const r = await call<{ airlines: { airline: string; name: string; carriers: string[] }[] | null }>("/v1/network/airlines");
    return r.airlines ?? [];
  },

  async seatMap(offer, segmentId) {
    try {
      const params = new URLSearchParams({ airline: offer.airline, segment_id: segmentId });
      return await call<SeatMap>(`/v1/offers/${encodeURIComponent(offer.offer_id)}/seats?${params}`);
    } catch (e) {
      // No map for that flight, or the airline sells none: not a failure of the trip.
      if (e instanceof NorbaError && (e.status === 404 || e.status === 501)) return null;
      throw e;
    }
  },

  async services(offer) {
    const r = await call<Service[] | null>(`/v1/offers/${encodeURIComponent(offer.offer_id)}/services?airline=${offer.airline}`);
    return r ?? [];
  },

  async quote(offer, seats, extras) {
    return call<OfferQuote>("/v1/offers/quote", {
      method: "POST",
      body: JSON.stringify({ offer_id: offer.offer_id, seats: seats.map(({ segment_id, row, column }) => ({ segment_id, row, column })), ancillaries: extras }),
    });
  },

  async createOrder(req: OrderRequest, idempotencyKey: string) {
    refuseProductionWrites();
    const res = await fetch(`${config.norba.baseUrl}/v1/orders`, {
      method: "POST",
      headers: { "X-API-Key": config.norba.apiKey, "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        offer_id: req.offer.offer_id,
        airline: req.offer.airline,
        passengers: req.passengers,
        contact: req.contact,
        seats: req.seats,
        ancillaries: req.extras,
        locale: req.locale,
        payment: { method: "CARD", currency: req.payment.currency, amount: req.payment.amount, card: req.payment.card },
      }),
      signal: AbortSignal.timeout(ORDER_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw await refusal(res);
    const order = (await res.json()) as Order;
    return { order, outcomeUnknown: res.headers.get("X-Norba-Payment-Outcome") === "unknown" };
  },

  async getOrder(orderId, airline) {
    return call<Order>(`/v1/orders/${encodeURIComponent(orderId)}?airline=${airline}`);
  },

  async reshop(order, q: ReshopQuery) {
    const slice = order.slices?.[q.sliceIndex];
    const body: Record<string, unknown> = { segment_ids: q.segmentIds ?? slice?.segments.map((g) => g.segment_id).filter(Boolean) };
    // Norba takes RFC 3339 timestamps here, not plain dates.
    const day = q.date ?? slice?.departure_utc.slice(0, 10);
    if (day) body[q.sliceIndex === 0 ? "new_departure_date" : "new_return_date"] = `${day}T00:00:00Z`;
    const r = await call<{ offers: Offer[] | null }>(`/v1/orders/${encodeURIComponent(order.order_id)}/reshop?airline=${order.airline}`, {
      method: "POST",
      body: JSON.stringify(body),
      timeout: SEARCH_TIMEOUT_MS,
    });
    return r.offers ?? [];
  },

  async changeOrder(order, offerId, idempotencyKey, payment) {
    refuseProductionWrites();
    const res = await fetch(`${config.norba.baseUrl}/v1/orders/${encodeURIComponent(order.order_id)}/change/confirm?airline=${order.airline}`, {
      method: "POST",
      headers: { "X-API-Key": config.norba.apiKey, "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ offer_id: offerId, ...(payment ? { payment: { method: "CARD", currency: payment.currency, amount: payment.amount, card: payment.card } } : {}) }),
      signal: AbortSignal.timeout(ORDER_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw await refusal(res);
    return { order: (await res.json()) as Order, outcomeUnknown: res.headers.get("X-Norba-Payment-Outcome") === "unknown" };
  },
};
