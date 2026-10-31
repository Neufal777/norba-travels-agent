import "server-only";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, duration, maxStops, money, totalMinutes } from "@/lib/format";
import { describeItinerary, groupItineraries, sortItineraries, tagOffers, type SortKey } from "@/lib/offers";
import type { AgentEvent, CabinClass, Offer, OffersBlock, SearchRequest } from "@/lib/types";
import type { ToolSchema } from "../llm/types";
import { norba, NorbaError } from "../norba";
import { learnPlaces, offerCodes, placeLabel, rememberAirports } from "./places";
import { lastSearch, remember, type Session } from "./sessions";
import { paxSlots, publish, resetFrom, step } from "./trip";

export type ToolContext = { session: Session; emit: (e: AgentEvent) => void; signal?: AbortSignal };

export type ToolOutcome = { content: string; detail?: string };

type Args = Record<string, unknown>;

export type Tool = {
  schema: ToolSchema;
  /** What the chat shows while the tool runs. */
  label: (a: Args, ctx: ToolContext) => string;
  /** IATA codes in the arguments, named before the label is shown so the step reads "MAD Madrid". */
  places?: (a: Args) => (string | undefined)[];
  run: (a: Args, ctx: ToolContext) => Promise<ToolOutcome>;
};

export const blockId = () => `b_${crypto.randomUUID().slice(0, 8)}`;
export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown, fallback?: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : fallback);
const code = (v: unknown) => str(v).toUpperCase();
const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"];
/** Itineraries described to the model per result; the traveller sees every one in the chat. */
const MODEL_ITINERARIES = 8;

function pax(r: SearchRequest) {
  const parts = [`${r.adults} adult${r.adults > 1 ? "s" : ""}`];
  if (r.children) parts.push(`${r.children} child${r.children > 1 ? "ren" : ""}`);
  if (r.infants) parts.push(`${r.infants} infant${r.infants > 1 ? "s" : ""}`);
  return parts.join(", ");
}

function titleOf(r: SearchRequest, session: Session) {
  const at = (c?: string) => placeLabel(session, c);
  const route = r.legs?.length ? r.legs.map((l) => at(l.origin)).concat(at(r.legs.at(-1)!.destination)).join(" → ") : `${at(r.origin)} ${r.return_date ? "⇄" : "→"} ${at(r.destination)}`;
  const when = r.legs?.length ? dateLabel(r.legs[0].departure_date) : `${dateLabel(r.departure_date!)}${r.return_date ? ` – ${dateLabel(r.return_date)}` : ""}`;
  return `${route} · ${when} · ${pax(r)}${r.cabin_class && r.cabin_class !== "economy" ? ` · ${r.cabin_class.replace("_", " ")}` : ""}`;
}

/** What the model reads back from a set of offers: counts, the three highlights and the top itineraries. */
function digest(offers: Offer[], refs: Record<string, string>) {
  if (!offers.length) return "No offers.";
  const its = groupItineraries(offers);
  const tags = tagOffers(offers);
  const ranked = sortItineraries(its, "best");
  const shown = ranked.slice(0, MODEL_ITINERARIES);
  for (const t of ["cheapest", "fastest"] as const) {
    const it = its.find((i) => tags[i.cheapest.offer_id]?.includes(t));
    if (it && !shown.includes(it)) shown.push(it);
  }
  const airlines = [...new Set(offers.map((o) => o.airline))];
  return [
    `${offers.length} offers, ${its.length} itineraries, airlines: ${airlines.join(", ")}. Prices are totals for all passengers, the agency fee included.`,
    `Best-ranked first (showing ${shown.length} of ${its.length}; the traveller sees all of them as cards):`,
    ...shown.map((it) => `- ${describeItinerary(it, refs, tags[it.cheapest.offer_id])}`),
  ].join("\n");
}

export function failure(e: unknown): ToolOutcome {
  if (e instanceof NorbaError) {
    const hint: Record<string, string> = {
      payment_required: "The Norba account behind this app has no metered requests left; nothing the traveller can fix.",
      date_out_of_range: "Dates must be from today to 361 days ahead.",
      same_airport: "Origin and destination must differ.",
      offer_expired: "That offer is gone; search again.",
      offer_not_priced: "The price hold ended; confirm the price again.",
      extra_not_priced: "A seat or extra is no longer sold; choose again.",
      airline_refused: "The airline refused; its reason is in the message.",
      booking_outcome_unknown: "The airline did not answer: the card may have been charged. Do NOT book again; the traveller should contact support with the attempt.",
      coming_soon: "Booking is switched off for now on this account.",
      carrier_agreement_required: "That airline is not available to this app yet.",
    };
    return { content: `ERROR ${e.code ?? e.status}: ${e.message}${e.code && hint[e.code] ? ` — ${hint[e.code]}` : ""}`, detail: e.code ?? `HTTP ${e.status}` };
  }
  if ((e as Error)?.name === "TimeoutError") return { content: "ERROR timeout: the airlines took too long to answer; try again.", detail: "timeout" };
  return { content: `ERROR: ${(e as Error)?.message ?? String(e)}`, detail: "failed" };
}

const findAirports: Tool = {
  schema: {
    type: "function",
    function: {
      name: "find_airports",
      description:
        "Resolve a city, airport or region the traveller named into IATA codes. Returns ranked matches, including metropolitan codes (LON, NYC, PAR) that search every airport of a city. Call it before search_flights whenever the traveller did not give an IATA code.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "City or airport name, or an IATA code, e.g. 'london', 'Santorini', 'JFK'" } },
        required: ["query"],
      },
    },
  },
  label: (a) => `Looking up “${str(a.query)}”`,
  async run(a, ctx) {
    const st = ctx.session.trip.view.steps.airports;
    step(ctx, "airports", "running", st.summary, `Finding airports for “${str(a.query)}”`);
    try {
      const found = await norba().airports(str(a.query));
      if (!found.length) {
        step(ctx, "airports", "waiting", `No match for “${str(a.query)}”`);
        return { content: `No airport matches “${str(a.query)}”.`, detail: "no match" };
      }
      rememberAirports(ctx, found);
      const codes = [...new Set([...(st.summary?.match(/\b[A-Z]{3}\b/g) ?? []), found[0].iata_code])].slice(-4);
      step(ctx, "airports", "done", codes.map((c) => placeLabel(ctx.session, c)).join(" · "));
      return {
        content: found.map((p) => `${p.iata_code} — ${p.name}${p.city ? `, ${p.city}` : ""}${p.country ? ` (${p.country})` : ""}${p.airport_type === "metropolitan_area" ? " [all airports of the city]" : ""}`).join("\n"),
        detail: found.slice(0, 4).map((p) => placeLabel(ctx.session, p.iata_code)).join(" · "),
      };
    } catch (e) {
      step(ctx, "airports", "failed", (e as Error).message);
      return failure(e);
    }
  },
};

const searchFlights: Tool = {
  schema: {
    type: "function",
    function: {
      name: "search_flights",
      description:
        "Search live flight offers from every airline Norba connects to, for one-way, round-trip or multi-city trips. Results stream into the chat as cards; you get a digest with short refs (o1, o2…) to cite. Each call is a metered request to the airlines: do not repeat a search the traveller already has — use refine_results to filter or re-sort it.",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "IATA airport or metropolitan code" },
          destination: { type: "string", description: "IATA airport or metropolitan code" },
          departure_date: { type: "string", description: "YYYY-MM-DD" },
          return_date: { type: "string", description: "YYYY-MM-DD; makes it a round trip" },
          adults: { type: "integer", minimum: 1, maximum: 9 },
          children: { type: "integer", minimum: 0, maximum: 8, description: "Aged 2–11" },
          infants: { type: "integer", minimum: 0, maximum: 4, description: "Under 2, at most one per adult" },
          cabin_class: { type: "string", enum: CABINS },
          max_stops: { type: "integer", minimum: 0, maximum: 5, description: "0 for non-stop only; omit for any" },
          currency: { type: "string", description: "ISO 4217, default EUR" },
          legs: {
            type: "array",
            description: "Multi-city only: 2–5 legs in date order; replaces origin/destination/dates",
            items: {
              type: "object",
              properties: { origin: { type: "string" }, destination: { type: "string" }, departure_date: { type: "string" } },
              required: ["origin", "destination", "departure_date"],
            },
          },
        },
        required: ["adults"],
      },
    },
  },
  places: (a) => [code(a.origin), code(a.destination), ...(Array.isArray(a.legs) ? (a.legs as Args[]).flatMap((l) => [code(l.origin), code(l.destination)]) : [])],
  label: (a, ctx) => {
    const at = (v: unknown) => placeLabel(ctx.session, code(v));
    const legs = Array.isArray(a.legs) ? (a.legs as Args[]) : [];
    return legs.length ? `Searching ${legs.map((l) => at(l.origin)).join(" → ")} → ${at(legs.at(-1)!.destination)}` : `Searching ${at(a.origin)} → ${at(a.destination)}`;
  },
  async run(a, ctx) {
    const { session, emit, signal } = ctx;
    const legs = Array.isArray(a.legs) ? (a.legs as Args[]).map((l) => ({ origin: code(l.origin), destination: code(l.destination), departure_date: str(l.departure_date) })) : [];
    const req: SearchRequest = {
      adults: int(a.adults, 1)!,
      children: int(a.children) || undefined,
      infants: int(a.infants) || undefined,
      cabin_class: CABINS.includes(a.cabin_class as CabinClass) ? (a.cabin_class as CabinClass) : undefined,
      max_stops: int(a.max_stops),
      currency: code(a.currency) || "EUR",
      ...(legs.length >= 2
        ? { legs }
        : { origin: code(a.origin), destination: code(a.destination), departure_date: str(a.departure_date), return_date: str(a.return_date) || undefined }),
    };
    const block: OffersBlock = {
      kind: "offers",
      id: blockId(),
      title: titleOf(req, session),
      request: req,
      offers: [],
      refs: {},
      tags: {},
      airlines: [],
      streaming: true,
    };
    // A new search starts the trip over from here; after a booking it is a new trip altogether.
    const trip = session.trip;
    if (trip.view.steps.booking.status === "done") resetFrom(ctx, "request");
    else resetFrom(ctx, "search");
    trip.request = req;
    trip.pax = paxSlots(req);
    if (trip.view.steps.airports.status === "pending")
      trip.view.steps.airports = { status: "done", summary: (req.legs?.map((l) => l.origin) ?? [req.origin, req.destination]).map((c) => placeLabel(session, c)).join(" · ") };
    step(ctx, "request", "done", block.title);
    step(ctx, "search", "running", undefined, `Asking every connected airline for ${block.title.split(" · ")[0]}`);
    emit({ type: "block", block });
    let seen = 0;
    const answered = new Set<string>();
    try {
      const result = await norba().search(
        req,
        (batch) => {
          seen += batch.length;
          void learnPlaces(ctx, offerCodes(batch));
          batch.forEach((o) => answered.add(o.airline));
          emit({ type: "offers_append", blockId: block.id, offers: batch, airlines: [...new Set(batch.map((o) => o.airline))] });
          trip.view.now = `${[...answered].map(airlineName).join(", ")} answered · ${seen} offers so far`;
          publish(ctx);
        },
        signal,
      );
      await learnPlaces(ctx, offerCodes(result.offers));
      block.offers = result.offers;
      block.airlines = result.meta.airlines ?? [];
      block.tags = tagOffers(result.offers);
      block.streaming = false;
      block.refs = remember(session, block).refs;
      emit({ type: "offers_final", block });
      if (!result.offers.length) {
        step(ctx, "search", "done", "No offers for this search");
        step(ctx, "choose", "waiting", "Change the dates or the route");
        return { content: `${block.title}: no airline returned offers for this search.`, detail: "no offers" };
      }
      step(ctx, "search", "done", `${result.offers.length} offers · ${block.airlines.join(" ")}`);
      step(ctx, "choose", "waiting", `Pick one of ${groupItineraries(result.offers).length} itineraries`);
      return {
        content: `${block.title}\n${digest(result.offers, block.refs)}\nAirports: ${[...new Set(offerCodes(result.offers))].map((c) => placeLabel(session, c)).join(", ")}.`,
        detail: `${result.offers.length} offers · ${block.airlines.join(" ")}`,
      };
    } catch (e) {
      emit({ type: "offers_final", block: { ...block, streaming: false } });
      step(ctx, "search", "failed", e instanceof NorbaError ? (e.code ?? e.message) : (e as Error).message);
      return failure(e);
    }
  },
};

const refineResults: Tool = {
  schema: {
    type: "function",
    function: {
      name: "refine_results",
      description:
        "Filter and re-sort the latest search without asking the airlines again (free and instant). Use it for follow-ups like 'only non-stop', 'leave after 10', 'with a checked bag', 'under 400', 'only Aegean', 'the fastest'. Shows the narrowed list as cards.",
      parameters: {
        type: "object",
        properties: {
          max_stops: { type: "integer", minimum: 0 },
          airlines: { type: "array", items: { type: "string" }, description: "IATA airline codes to keep" },
          depart_after: { type: "string", description: "HH:MM, outbound local departure time" },
          depart_before: { type: "string", description: "HH:MM, outbound local departure time" },
          return_depart_after: { type: "string", description: "HH:MM, return flight local departure time" },
          return_depart_before: { type: "string", description: "HH:MM, return flight local departure time" },
          max_price: { type: "number", description: "Total for all passengers" },
          max_duration_hours: { type: "number", description: "Per direction" },
          checked_bag: { type: "boolean", description: "true: only fares with a checked bag" },
          refundable: { type: "boolean", description: "true: only refundable fares" },
          sort: { type: "string", enum: ["best", "cheapest", "fastest", "earliest"] },
        },
      },
    },
  },
  label: () => "Narrowing the results",
  async run(a, ctx) {
    const { session, emit } = ctx;
    const last = lastSearch(session);
    if (!last) return { content: "ERROR: there is no search to refine yet; call search_flights first.", detail: "no search" };
    const applied: string[] = [];
    const hhmm = (v: unknown) => (/^\d{1,2}:\d{2}$/.test(str(v)) ? str(v).padStart(5, "0") : "");
    let list = last.offers;
    const keep = (label: string, pred: (o: Offer) => boolean) => {
      list = list.filter(pred);
      applied.push(label);
    };
    const stops = int(a.max_stops);
    if (stops != null) keep(stops === 0 ? "non-stop" : `≤ ${stops} stop${stops > 1 ? "s" : ""}`, (o) => maxStops(o) <= stops);
    const airlines = Array.isArray(a.airlines) ? (a.airlines as unknown[]).map(code).filter(Boolean) : [];
    if (airlines.length) keep(airlines.join("/"), (o) => airlines.includes(o.airline) || o.slices.every((s) => s.segments.every((g) => airlines.includes(g.marketing_carrier ?? ""))));
    if (hhmm(a.depart_after)) keep(`out after ${hhmm(a.depart_after)}`, (o) => clock(o.slices[0].departure_utc) >= hhmm(a.depart_after));
    if (hhmm(a.depart_before)) keep(`out before ${hhmm(a.depart_before)}`, (o) => clock(o.slices[0].departure_utc) <= hhmm(a.depart_before));
    if (hhmm(a.return_depart_after)) keep(`back after ${hhmm(a.return_depart_after)}`, (o) => !o.slices[1] || clock(o.slices[1].departure_utc) >= hhmm(a.return_depart_after));
    if (hhmm(a.return_depart_before)) keep(`back before ${hhmm(a.return_depart_before)}`, (o) => !o.slices[1] || clock(o.slices[1].departure_utc) <= hhmm(a.return_depart_before));
    if (typeof a.max_price === "number") keep(`≤ ${money(a.max_price, list[0]?.currency ?? last.offers[0]?.currency ?? "EUR")}`, (o) => o.total_amount <= (a.max_price as number));
    if (typeof a.max_duration_hours === "number") keep(`≤ ${a.max_duration_hours}h`, (o) => o.slices.every((s) => s.duration_minutes <= (a.max_duration_hours as number) * 60));
    if (a.checked_bag === true) keep("checked bag", (o) => Boolean(o.baggage_included));
    if (a.refundable === true) keep("refundable", (o) => o.fare_rules?.refundable === true);
    const sort = (["best", "cheapest", "fastest", "earliest"] as SortKey[]).includes(a.sort as SortKey) ? (a.sort as SortKey) : undefined;
    if (sort) applied.push(`sorted by ${sort}`);

    const ordered = sort ? sortItineraries(groupItineraries(list), sort).flatMap((i) => i.offers) : list;
    const block: OffersBlock = {
      kind: "offers",
      id: blockId(),
      title: titleOf(last.request, session),
      request: last.request,
      offers: ordered,
      refs: last.refs,
      tags: tagOffers(ordered),
      airlines: [...new Set(ordered.map((o) => o.airline))],
      streaming: false,
      filter: applied.join(" · ") || "all results",
    };
    emit({ type: "block", block });
    if (session.trip.view.steps.choose.status !== "done") step(ctx, "choose", "waiting", `${groupItineraries(ordered).length} itineraries · ${block.filter}`);
    if (!ordered.length) return { content: `Nothing in the last search matches: ${block.filter}. ${last.offers.length} offers before filtering.`, detail: "no match" };
    return { content: `Filter: ${block.filter}\n${digest(ordered, last.refs)}`, detail: `${groupItineraries(ordered).length} itineraries` };
  },
};

const priceCalendar: Tool = {
  schema: {
    type: "function",
    function: {
      name: "price_calendar",
      description:
        "Cheapest fare per passenger per day on a route, for flexible dates. Calls no airline: days come from recent searches whose offers are still valid, so it can be sparse or empty — then say so and offer to search specific dates.",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          from: { type: "string", description: "YYYY-MM-DD, first day" },
          to: { type: "string", description: "YYYY-MM-DD, last day" },
          trip_type: { type: "string", enum: ["one_way", "round_trip"] },
          departure_date: { type: "string", description: "Round trip: the outbound date whose return days you want" },
          cabin_class: { type: "string", enum: CABINS },
        },
        required: ["origin", "destination", "from", "to"],
      },
    },
  },
  places: (a) => [code(a.origin), code(a.destination)],
  label: (a, ctx) => `Reading prices ${placeLabel(ctx.session, code(a.origin))} → ${placeLabel(ctx.session, code(a.destination))}`,
  async run(a, { emit }) {
    try {
      const q = {
        origin: code(a.origin),
        destination: code(a.destination),
        from: str(a.from),
        to: str(a.to),
        trip_type: a.trip_type === "round_trip" ? ("round_trip" as const) : undefined,
        departure_date: str(a.departure_date) || undefined,
        cabin_class: CABINS.includes(a.cabin_class as CabinClass) ? str(a.cabin_class) : undefined,
      };
      const r = await norba().calendar(q);
      emit({ type: "block", block: { kind: "calendar", id: blockId(), origin: q.origin, destination: q.destination, currency: r.currency, days: r.days } });
      if (!r.days.length) return { content: "No prices known for those days yet.", detail: "empty" };
      const cheapest = [...r.days].sort((x, y) => x.amount - y.amount).slice(0, 5);
      return {
        content: `${r.days.length} days with a price (${r.currency}, per passenger). Cheapest: ${cheapest.map((d) => `${d.date} ${money(d.amount, r.currency)}`).join(", ")}.`,
        detail: `${r.days.length} days`,
      };
    } catch (e) {
      return failure(e);
    }
  },
};

const priceOffer: Tool = {
  schema: {
    type: "function",
    function: {
      name: "price_offer",
      description:
        "Confirm an offer's price with the airline right now (OfferPrice) before the traveller books. Pass the ref from the results (e.g. 'o4'). The answer says if the price changed and until when it is guaranteed.",
      parameters: { type: "object", properties: { ref: { type: "string", description: "Offer ref such as o4" } }, required: ["ref"] },
    },
  },
  label: (a) => `Confirming the price of ${str(a.ref)}`,
  async run(a, ctx) {
    const { session, emit } = ctx;
    const ref = str(a.ref).toLowerCase();
    const offer = session.offers.get(ref);
    if (!offer) return { content: `ERROR: no offer ${ref} in this conversation.`, detail: "unknown ref" };
    const trip = session.trip;
    if (trip.view.steps.booking.status === "done") return { content: "ERROR: this trip is already booked; search again to start another.", detail: "already booked" };
    const search = session.searches.find((s) => s.refs[offer.offer_id]);
    // Choosing another flight, or the same one again, undoes the seats, extras and quote made for the old price.
    resetFrom(ctx, "price");
    if (search && search.request !== trip.request) {
      trip.request = search.request;
      trip.pax = paxSlots(search.request);
    }
    trip.chosenRef = ref;
    const s0 = offer.slices[0];
    step(ctx, "choose", "done", `${ref} · ${airlineName(offer.airline)} ${clock(s0.departure_utc)}→${clock(s0.arrival_utc)}${offer.fare_family?.name ? ` · ${offer.fare_family.name}` : ""}`);
    step(ctx, "price", "running", undefined, `Asking ${airlineName(offer.airline)} to confirm the fare`);
    try {
      const priced = await norba().price(offer);
      trip.priced = priced;
      emit({ type: "block", block: { kind: "priced", id: blockId(), ref, offer: priced, previousAmount: offer.total_amount } });
      const changed = Math.abs(priced.total_amount - offer.total_amount) >= 0.01;
      const until = priced.price_guaranteed_until ? ` · held ${Math.max(0, Math.round((Date.parse(priced.price_guaranteed_until) - Date.now()) / 60_000))} min` : "";
      step(ctx, "price", "done", `${money(priced.total_amount, priced.currency, { cents: true })}${changed ? " (changed)" : ""}${until}`);
      return {
        content: `${ref} confirmed at ${money(priced.total_amount, priced.currency, { cents: true })}${changed ? ` (was ${money(offer.total_amount, offer.currency, { cents: true })})` : " (unchanged)"}, guaranteed until ${priced.price_guaranteed_until ?? "unknown"}. ${priced.slices.map((s) => `${s.origin}→${s.destination} ${duration(s.duration_minutes)}`).join(", ")}, total ${duration(totalMinutes(priced))}. Next: seats (choose_seats), then extras, travellers, review and payment.`,
        detail: changed ? "price changed" : "unchanged",
      };
    } catch (e) {
      step(ctx, "price", "failed", e instanceof NorbaError ? (e.code ?? e.message) : (e as Error).message);
      return failure(e);
    }
  },
};

const suggestReplies: Tool = {
  schema: {
    type: "function",
    function: {
      name: "suggest_replies",
      description:
        "Offer 2–5 short tappable replies under your message, when the traveller has to choose (which London airport, which dates, one-way or return) or for natural next steps. Each option is sent back verbatim as their message, so word it as they would.",
      parameters: {
        type: "object",
        properties: { options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 } },
        required: ["options"],
      },
    },
  },
  label: () => "Suggesting replies",
  async run(a, { emit }) {
    const options = (Array.isArray(a.options) ? a.options : []).map(str).filter(Boolean).slice(0, 5);
    if (options.length) emit({ type: "block", block: { kind: "replies", id: blockId(), options } });
    return { content: "Shown.", detail: `${options.length} options` };
  },
};

const listAirlines: Tool = {
  schema: {
    type: "function",
    function: {
      name: "list_airlines",
      description: "The airlines a search reaches today, each with the group and regional carriers it sells. Use it when asked which airlines or where you can fly.",
      parameters: { type: "object", properties: {} },
    },
  },
  label: () => "Listing the connected airlines",
  async run() {
    try {
      const list = await norba().networkAirlines();
      return { content: list.map((a) => `${a.airline} ${a.name}${a.carriers.length > 1 ? ` (also sells ${a.carriers.filter((c) => c !== a.airline).join(", ")})` : ""}`).join("\n") || "None.", detail: `${list.length} airlines` };
    } catch (e) {
      return failure(e);
    }
  },
};

export const SHOPPING_TOOLS: Tool[] = [findAirports, searchFlights, refineResults, priceCalendar, priceOffer, suggestReplies, listAirlines];
