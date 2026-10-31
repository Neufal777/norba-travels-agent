import "server-only";

import type { AgentEvent, Airport, Offer } from "@/lib/types";
import { norba } from "../norba";

type Ctx = { session: { places: Map<string, string> }; emit: (e: AgentEvent) => void };

/**
 * The name that goes beside a code: the city for a metropolitan code or a city's only airport, the airport's own
 * name where a city has several ("London Heathrow"), without the word "Airport".
 */
export function shortName(a: Airport) {
  const city = a.city?.trim();
  if (a.airport_type === "metropolitan_area") return city || a.name.replace(/\s*\(all airports\)/i, "");
  let name = a.name.replace(/\b(International\s+)?Airport\b/gi, "").replace(/\s{2,}/g, " ").replace(/[\s,–-]+$/, "").trim();
  if (!a.metro_code) return city || name;
  if (!city) return name;
  // Official names carry a lot before and after the city: "Adolfo Suárez Madrid-Barajas" reads as "Madrid-Barajas",
  // "Spata-Artemida Athens Eleftherios Venizelos" as "Athens Eleftherios Venizelos", "Santorini Island Santorini" as
  // "Santorini Island".
  const at = name.toLowerCase().indexOf(city.toLowerCase());
  if (at > 0) name = name.slice(at);
  if (name.length > city.length && name.toLowerCase().endsWith(` ${city.toLowerCase()}`) && name.toLowerCase().startsWith(city.toLowerCase())) name = name.slice(0, -city.length - 1).trim();
  return at < 0 ? `${city} ${name}` : name;
}

function publish(ctx: Ctx) {
  ctx.emit({ type: "places", places: Object.fromEntries(ctx.session.places) });
}

/** Remembers airports already in hand (a find_airports answer) and tells the chat. */
export function rememberAirports(ctx: Ctx, airports: Airport[]) {
  let added = false;
  for (const a of airports) {
    if (!a.iata_code || ctx.session.places.has(a.iata_code)) continue;
    ctx.session.places.set(a.iata_code, shortName(a));
    added = true;
  }
  if (added) publish(ctx);
}

/** Looks up the codes this conversation has no name for yet, in one call; a failed lookup leaves them bare. */
export async function learnPlaces(ctx: Ctx, codes: (string | undefined)[]) {
  const unknown = [...new Set(codes.filter((c): c is string => Boolean(c && /^[A-Z]{3}$/.test(c))))].filter((c) => !ctx.session.places.has(c));
  if (!unknown.length) return;
  try {
    rememberAirports(ctx, (await norba().airportsByCode(unknown)).filter((a) => unknown.includes(a.iata_code)));
  } catch {
    // Names are a courtesy: the codes still read on their own.
  }
}

/** Every airport an offer touches: ends and connections. */
export const offerCodes = (offers: Offer[]) => offers.flatMap((o) => o.slices.flatMap((s) => s.segments.flatMap((g) => [g.origin, g.destination])));

/** "Madrid (MAD)" for a sentence, or the code alone while its name is unknown. */
export function placeProse(session: { places: Map<string, string> }, code?: string) {
  if (!code) return "";
  const name = session.places.get(code);
  return name ? `${name} (${code})` : code;
}

/** "MAD Madrid", or the code alone while its name is unknown. */
export function placeLabel(session: { places: Map<string, string> }, code?: string) {
  if (!code) return "";
  const name = session.places.get(code);
  return name ? `${code} ${name}` : code;
}
