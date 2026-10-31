import { clock, dayShift, duration, maxStops, money, totalMinutes } from "./format";
import type { Offer, OfferTag } from "./types";

/**
 * One itinerary (the same flights at the same times) sold at one or more fares: Basic, Classic, Flex… An airline
 * answers each fare as its own offer; the chat shows them as one card with the fares to choose from.
 */
export type Itinerary = { key: string; offers: Offer[]; cheapest: Offer };

export const itineraryKey = (o: Offer) =>
  `${o.airline}|${o.slices.map((s) => s.segments.map((g) => `${g.flight_number ?? ""}@${g.departure_utc}`).join(">")).join("|")}`;

export function groupItineraries(offers: Offer[]): Itinerary[] {
  const groups = new Map<string, Offer[]>();
  for (const o of offers) {
    const k = itineraryKey(o);
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.total_amount - b.total_amount);
    return { key, offers: sorted, cheapest: sorted[0] };
  });
}

export type SortKey = "best" | "cheapest" | "fastest" | "earliest";

/**
 * "Best" weighs price against time in the air: an hour is worth about 6% of the cheapest fare, a connection
 * another hour. It is a ranking hint, not a claim about the traveller's preferences.
 */
export function bestScore(o: Offer, minPrice: number) {
  return o.total_amount / Math.max(minPrice, 1) + (totalMinutes(o) / 60) * 0.06 + maxStops(o) * 0.06;
}

export function sortItineraries(list: Itinerary[], by: SortKey): Itinerary[] {
  const min = Math.min(...list.map((i) => i.cheapest.total_amount));
  const cmp: Record<SortKey, (a: Itinerary, b: Itinerary) => number> = {
    cheapest: (a, b) => a.cheapest.total_amount - b.cheapest.total_amount,
    fastest: (a, b) => totalMinutes(a.cheapest) - totalMinutes(b.cheapest) || a.cheapest.total_amount - b.cheapest.total_amount,
    best: (a, b) => bestScore(a.cheapest, min) - bestScore(b.cheapest, min),
    earliest: (a, b) => a.cheapest.slices[0].departure_utc.localeCompare(b.cheapest.slices[0].departure_utc),
  };
  return [...list].sort(cmp[by]);
}

/** Cheapest, fastest and best itinerary of a result, by offer_id of its cheapest fare. */
export function tagOffers(offers: Offer[]): Record<string, OfferTag[]> {
  const its = groupItineraries(offers);
  const tags: Record<string, OfferTag[]> = {};
  if (!its.length) return tags;
  const add = (o: Offer, t: OfferTag) => (tags[o.offer_id] = [...(tags[o.offer_id] ?? []), t]);
  add(sortItineraries(its, "cheapest")[0].cheapest, "cheapest");
  add(sortItineraries(its, "fastest")[0].cheapest, "fastest");
  add(sortItineraries(its, "best")[0].cheapest, "best");
  return tags;
}

/** One line per itinerary for the model: everything it needs to compare and cite, nothing it does not. */
export function describeItinerary(it: Itinerary, refs: Record<string, string>, tags: OfferTag[] = []) {
  const o = it.cheapest;
  const legs = o.slices
    .map((s) => {
      const shift = dayShift(s.departure_utc, s.arrival_utc);
      const via = s.segments.slice(0, -1).map((g) => g.destination);
      return `${s.origin} ${s.departure_utc.slice(0, 10)} ${clock(s.departure_utc)} → ${s.destination} ${clock(s.arrival_utc)}${shift ? ` (+${shift}d)` : ""} ${duration(s.duration_minutes)} ${s.stops ? `${s.stops} stop via ${via.join(",")}` : "non-stop"} [${s.segments.map((g) => g.flight_number).join(",")}]`;
    })
    .join(" | ");
  const fares = it.offers
    .map((f) => `${refs[f.offer_id] ?? "?"} ${f.fare_family?.name ?? "fare"} ${money(f.total_amount, f.currency, { cents: true })}${f.baggage_included ? " +bag" : ""}${f.fare_rules?.refundable ? " refundable" : ""}`)
    .join("; ");
  return `${o.airline}${tags.length ? ` (${tags.join(",")})` : ""}: ${legs} — fares: ${fares}`;
}
