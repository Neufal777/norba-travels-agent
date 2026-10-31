import "server-only";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, duration, money } from "@/lib/format";
import { groupItineraries, sortItineraries } from "@/lib/offers";
import type { CabinClass, GroupBlock, GroupLane, GroupOption, Offer } from "@/lib/types";
import { brainMode, config } from "../config";
import { modelLabel, structured } from "../llm/meta";
import { norba } from "../norba";
import { onPaid, openCheckout, slotsFor } from "../checkout";
import { learnPlaces, offerCodes, placeLabel, rememberAirports } from "./places";
import { keepOrder } from "./servicing-tools";
import { pushUpdate, type Session } from "./sessions";
import { resetFrom, step } from "./trip";
import { blockId, failure, str, type Tool, type ToolContext } from "./tools";

/*
 * A trip for several people leaving from several cities to meet in one place. Each traveller gets their own agent —
 * Muse Spark acting for that person alone, with their preferences and budget — which searches from their city and
 * puts forward its best three flights. A coordinator, Muse Spark thinking harder, then picks one flight per person so
 * everyone lands close together. Code checks the coordinator's pick (real refs, the arrival window, the budget) and
 * says so when it had to correct it. Holding gives each traveller their own checkout link; each pays their own seat.
 */

const CANDIDATES = 10;
const SHORTLIST = 3;
/** Flights beyond the shortlist the coordinator may also use, spread over the day, per traveller. */
const ALTERNATES = 3;
const MAX_TRAVELLERS = 6;

export type StoredGroup = { block: GroupBlock; options: Map<string, { laneId: string; offer: Offer }>; cabin?: CabinClass };

const arrives = (o: GroupOption) => Date.parse(o.outbound.arrival_utc);

/** Minutes between the first and the last arrival of a set of choices. */
const spread = (choices: GroupOption[]) => (choices.length ? Math.round((Math.max(...choices.map(arrives)) - Math.min(...choices.map(arrives))) / 60_000) : 0);

function option(o: Offer, ref: string): GroupOption {
  return { ref, airline: o.airline, total: o.total_amount, currency: o.currency, fare: o.fare_family?.name, bag: Boolean(o.baggage_included), outbound: o.slices[0], inbound: o.slices[1] };
}

function line(s: Session, o: GroupOption) {
  const out = o.outbound;
  const back = o.inbound ? `; back ${dateLabel(o.inbound.departure_utc.slice(0, 10))} ${clock(o.inbound.departure_utc)} → ${clock(o.inbound.arrival_utc)}` : "";
  return `${o.ref}: ${airlineName(o.airline)} ${clock(out.departure_utc)} ${placeLabel(s, out.origin)} → arrives ${clock(out.arrival_utc)} ${placeLabel(s, out.destination)} (${out.arrival_utc}), ${out.stops ? `${out.stops} stop` : "non-stop"}, ${duration(out.duration_minutes)}${back}, ${money(o.total, o.currency)}${o.bag ? ", bag included" : ""}`;
}

/** The rules a traveller's agent falls back on without a model: "non-stop", "after 10". A rule that leaves nothing is dropped. */
function heuristicPicks(prefs: string, options: GroupOption[]) {
  const keep = (pool: GroupOption[], test: (o: GroupOption) => boolean) => (pool.some(test) ? pool.filter(test) : pool);
  let pool = options;
  if (/non-?stop|direct/i.test(prefs)) pool = keep(pool, (o) => !o.outbound.stops);
  const after = prefs.match(/after (\d{1,2})/i);
  if (after) pool = keep(pool, (o) => Number(clock(o.outbound.departure_utc).slice(0, 2)) >= Number(after[1]));
  return pool.slice(0, SHORTLIST).map((o, i) => ({ ref: o.ref, reason: i ? "Next best for price and time" : "Best price for the time in the air" }));
}

/** One traveller's agent: searches from their city, then Muse Spark picks their best three for them. */
async function travellerAgent(ctx: ToolContext, g: StoredGroup, lane: GroupLane, next: () => string, publish: () => void) {
  const b = g.block;
  try {
    const { offers } = await norba().search({ origin: lane.origin, destination: b.destination, departure_date: b.departDate, return_date: b.returnDate, adults: 1, cabin_class: g.cabin }, () => {}, ctx.signal);
    await learnPlaces(ctx, offerCodes(offers));
    const its = sortItineraries(groupItineraries(offers), "best").slice(0, CANDIDATES);
    if (!its.length) {
      lane.status = "failed";
      lane.note = "No flights from here on those dates";
      return publish();
    }
    const candidates = its.map((it) => {
      const ref = next();
      g.options.set(ref, { laneId: lane.id, offer: it.cheapest });
      return option(it.cheapest, ref);
    });
    lane.status = "choosing";
    publish();

    let picks: { ref: string; reason: string }[];
    if (brainMode() === "meta") {
      const r = await structured<{ picks: { ref: string; reason: string }[]; note: string }>(
        [
          {
            role: "system",
            content: `You are ${lane.name}'s own travel agent. You act for ${lane.name} alone: their preferences and budget come first, not the group's. Pick up to ${SHORTLIST} flights from the list, best first, each with a reason of at most eight words. Only refs from the list.`,
          },
          {
            role: "user",
            content: `${lane.name} flies from ${placeLabel(ctx.session, lane.origin)} to ${placeLabel(ctx.session, b.destination)}, out ${b.departDate}${b.returnDate ? `, back ${b.returnDate}` : ""}.\nPreferences: ${lane.preferences || "none given"}.\nBudget: ${b.budget ? money(b.budget, b.currency) + " per person" : "not set"}.\nThe group wants to land close together, so prefer variety in arrival times among good options.\n\n${candidates.map((o) => `- ${line(ctx.session, o)}`).join("\n")}`,
          },
        ],
        "traveller_shortlist",
        {
          type: "object",
          additionalProperties: false,
          required: ["picks", "note"],
          properties: {
            picks: { type: "array", items: { type: "object", additionalProperties: false, required: ["ref", "reason"], properties: { ref: { type: "string" }, reason: { type: "string" } } } },
            note: { type: "string", description: "One short line on what you weighed for this traveller" },
          },
        },
        { signal: ctx.signal },
      );
      picks = r.picks.filter((p) => candidates.some((c) => c.ref === p.ref)).slice(0, SHORTLIST);
      lane.note = r.note;
      if (!picks.length) picks = heuristicPicks(lane.preferences ?? "", candidates);
    } else {
      picks = heuristicPicks(lane.preferences ?? "", candidates);
    }
    lane.shortlist = picks.map((p) => ({ ...candidates.find((c) => c.ref === p.ref)!, reason: p.reason }));
    // The coordinator also sees a few other flights landing at other times, so a group can meet when no traveller's
    // top three line up.
    const rest = candidates.filter((c) => !lane.shortlist.some((x) => x.ref === c.ref)).sort((x, y) => arrives(x) - arrives(y));
    lane.alternates = rest.length <= ALTERNATES ? rest : Array.from({ length: ALTERNATES }, (_, i) => rest[Math.round((i * (rest.length - 1)) / (ALTERNATES - 1))]);
    lane.status = "ready";
  } catch (e) {
    lane.status = "failed";
    lane.note = failure(e).content.replace(/^ERROR[^:]*:\s*/, "");
  }
  publish();
}

/** Every combination of one shortlisted flight per traveller, scored: inside the window and budget first, then spread, then price. */
function bestCombination(lanes: GroupLane[], window: number, budget?: number) {
  let best: { choices: GroupOption[]; score: number } | undefined;
  const walk = (i: number, acc: GroupOption[]) => {
    if (i === lanes.length) {
      const sp = spread(acc);
      const over = budget ? acc.filter((o) => o.total > budget).length : 0;
      const score = (sp > window ? 10_000 : 0) + over * 5_000 + sp + acc.reduce((a, o) => a + o.total, 0) / 100;
      if (!best || score < best.score) best = { choices: [...acc], score };
      return;
    }
    for (const o of [...lanes[i].shortlist, ...(lanes[i].alternates ?? [])]) walk(i + 1, [...acc, o]);
  };
  walk(0, []);
  return best?.choices ?? [];
}

/** The coordinator: Muse Spark, thinking harder, picks one flight per traveller so the group lands together. */
async function coordinate(ctx: ToolContext, g: StoredGroup, publish: () => void) {
  const b = g.block;
  const lanes = b.lanes.filter((l) => l.shortlist.length);
  b.coordinator = { status: "thinking", model: brainMode() === "meta" ? `${modelLabel()} · reasoning ${config.model.plannerEffort}` : "rules" };
  publish();
  let chosen: GroupOption[] | undefined;
  if (brainMode() === "meta") {
    try {
      const r = await structured<{ choices: { traveller: string; ref: string }[]; rationale: string; arrival_window_minutes: number }>(
        [
          {
            role: "system",
            content:
              "You coordinate a group trip. Each traveller's own agent shortlisted flights for them (#1 is their favourite); a few other flights are also possible. Pick exactly one flight per traveller so that, in order of importance: everyone lands inside the arrival window; nobody goes over the budget; arrivals are as close together as possible; each traveller gets an option their agent ranked high (use an 'also possible' flight only when it brings the group together); the group's total is low. Explain your choice in two short sentences a traveller understands. Only refs from each traveller's own lists.",
          },
          {
            role: "user",
            content: `Destination ${placeLabel(ctx.session, b.destination)}, out ${b.departDate}${b.returnDate ? `, back ${b.returnDate}` : ""}. Arrival window: ${b.windowMinutes} minutes. Budget: ${b.budget ? money(b.budget, b.currency) + " per person" : "none"}.\n\n${lanes
              .map(
                (l) =>
                  `TRAVELLER ${l.name} from ${placeLabel(ctx.session, l.origin)}${l.preferences ? ` (wants: ${l.preferences})` : ""}\n${l.shortlist.map((o, i) => `- #${i + 1} ${line(ctx.session, o)}`).join("\n")}` +
                  (l.alternates?.length ? `\n  also possible, not in their top three:\n${l.alternates.map((o) => `  - ${line(ctx.session, o)}`).join("\n")}` : ""),
              )
              .join("\n\n")}`,
          },
        ],
        "group_plan",
        {
          type: "object",
          additionalProperties: false,
          required: ["choices", "rationale", "arrival_window_minutes"],
          properties: {
            choices: { type: "array", items: { type: "object", additionalProperties: false, required: ["traveller", "ref"], properties: { traveller: { type: "string" }, ref: { type: "string" } } } },
            rationale: { type: "string" },
            arrival_window_minutes: { type: "integer", description: "Minutes between the first and last arrival of your choice" },
          },
        },
        { effort: config.model.plannerEffort, signal: ctx.signal },
      );
      const picked = lanes.map((l) => {
        const c = r.choices.find((x) => x.traveller.trim().toLowerCase() === l.name.toLowerCase());
        return [...l.shortlist, ...(l.alternates ?? [])].find((o) => o.ref === c?.ref);
      });
      if (picked.every(Boolean)) chosen = picked as GroupOption[];
      b.coordinator.rationale = r.rationale;
    } catch (e) {
      b.coordinator.checked = `The coordinator did not answer (${(e as Error).message.slice(0, 80)}); the plan was worked out by the rules.`;
    }
  }
  const fallback = bestCombination(lanes, b.windowMinutes, b.budget);
  // The model's plan stands when it keeps the window; a plan outside it gives way to a checked combination that lands
  // the group closer together, and the chat says so.
  if (chosen && spread(chosen) > b.windowMinutes && spread(fallback) < spread(chosen)) {
    b.coordinator.checked = `Checked: that plan landed ${spread(chosen)} min apart; this one lands everyone within ${spread(fallback)} min.`;
    // The model's words described the plan it chose; the one kept is described as it is.
    b.coordinator.rationale = undefined;
    chosen = fallback;
  }
  chosen ??= fallback;
  lanes.forEach((l, i) => (l.choice = chosen![i]));
  b.coordinator.spreadMinutes = spread(chosen);
  b.coordinator.rationale ??= `Everyone lands within ${b.coordinator.spreadMinutes} minutes for ${money(chosen.reduce((a, o) => a + o.total, 0), b.currency)} in all.`;
  b.coordinator.status = "done";
  publish();
}

const planGroupTrip: Tool = {
  schema: {
    type: "function",
    function: {
      name: "plan_group_trip",
      description:
        "Plans a trip for several people leaving from different cities to meet in one place: one agent per traveller searches and shortlists from their city, a coordinator picks one flight each so they land close together. Use when two or more travellers start from different places. The traveller then holds everyone's seats with a button; each pays their own link.",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string", description: "IATA code or city of the meeting place" },
          depart_date: { type: "string", description: "YYYY-MM-DD, the day everyone flies in" },
          return_date: { type: "string", description: "YYYY-MM-DD, the day everyone flies home; omit for one way" },
          travellers: {
            type: "array",
            description: "Each traveller, including the one writing",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                origin: { type: "string", description: "IATA code or city they leave from" },
                preferences: { type: "string", description: "Their own wishes in a few words: 'non-stop', 'after 10:00', 'cheapest'" },
              },
              required: ["name", "origin"],
            },
          },
          arrive_within_minutes: { type: "integer", description: "How close together the arrivals must be; default 120" },
          budget_per_person: { type: "number" },
          currency: { type: "string" },
          cabin_class: { type: "string", enum: ["economy", "premium_economy", "business", "first"] },
        },
        required: ["destination", "depart_date", "travellers"],
      },
    },
  },
  label: (a) => `Planning a group trip for ${Array.isArray(a.travellers) ? a.travellers.length : "several"} travellers`,
  async run(a, ctx) {
    const s = ctx.session;
    const list = (Array.isArray(a.travellers) ? a.travellers : []) as { name?: string; origin?: string; preferences?: string }[];
    if (list.length < 2) return { content: "ERROR: a group trip needs at least two travellers with their cities." };
    if (list.length > MAX_TRAVELLERS) return { content: `ERROR: up to ${MAX_TRAVELLERS} travellers per group trip.` };
    const depart = str(a.depart_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(depart)) return { content: "ERROR: depart_date must be YYYY-MM-DD." };

    try {
      // Cities become codes first, all at once.
      const resolve = async (place: string) => {
        const p = place.trim();
        if (/^[A-Za-z]{3}$/.test(p)) return p.toUpperCase();
        const found = await norba().airports(p);
        rememberAirports(ctx, found);
        if (!found[0]) throw new Error(`no airport found for "${p}"`);
        return found[0].iata_code;
      };
      const destination = await resolve(str(a.destination));
      const origins = await Promise.all(list.map((t) => resolve(str(t.origin))));
      await learnPlaces(ctx, [destination, ...origins]);

      const block: GroupBlock = {
        kind: "group",
        id: blockId(),
        title: `${list.length} travellers to ${placeLabel(s, destination)}`,
        destination,
        departDate: depart,
        returnDate: /^\d{4}-\d{2}-\d{2}$/.test(str(a.return_date)) ? str(a.return_date) : undefined,
        windowMinutes: typeof a.arrive_within_minutes === "number" && a.arrive_within_minutes > 0 ? Math.round(a.arrive_within_minutes) : 120,
        budget: typeof a.budget_per_person === "number" && a.budget_per_person > 0 ? a.budget_per_person : undefined,
        currency: str(a.currency).toUpperCase() || "EUR",
        lanes: list.map((t, i) => ({ id: `L${i + 1}`, name: str(t.name) || `Traveller ${i + 1}`, origin: origins[i], preferences: str(t.preferences) || undefined, status: "searching", shortlist: [] })),
        coordinator: { status: "waiting" },
      };
      const cabin = ["economy", "premium_economy", "business", "first"].includes(str(a.cabin_class)) ? (str(a.cabin_class) as CabinClass) : undefined;
      const g: StoredGroup = { block, options: new Map(), cabin };
      s.groups.set(block.id, g);
      // The side panel follows the group as one trip: one request, four searches, one plan.
      resetFrom(ctx, "request");
      step(ctx, "request", "done", `Group trip · ${list.length} travellers`);
      step(ctx, "airports", "done", [...new Set([...origins, destination])].join(" · "));
      step(ctx, "search", "running", undefined, `${list.length} agents searching from ${list.length} cities`);
      let n = 0;
      const next = () => `g${++n}`;
      const publish = () => ctx.emit({ type: "block", block: structuredClone(block) });
      publish();

      await Promise.all(block.lanes.map((lane) => travellerAgent(ctx, g, lane, next, publish)));
      if (block.lanes.filter((l) => l.shortlist.length).length < 2) {
        block.coordinator = { status: "failed", rationale: "Not enough travellers have flights to plan together." };
        publish();
        return { content: `ERROR: flights were found for ${block.lanes.filter((l) => l.shortlist.length).map((l) => l.name).join(", ") || "nobody"} only. ${block.lanes.filter((l) => l.status === "failed").map((l) => `${l.name}: ${l.note}`).join("; ")}` };
      }
      step(ctx, "search", "done", `${block.lanes.filter((l) => l.shortlist.length).length} of ${list.length} shortlisted`);
      step(ctx, "choose", "running", undefined, "The coordinator is fitting everyone together");
      await coordinate(ctx, g, publish);
      step(ctx, "choose", "waiting", `Plan · ${block.coordinator.spreadMinutes} min apart`, "Hold everyone's seats when ready");

      const lines = block.lanes.map((l) => (l.choice ? `- ${l.name}: ${line(s, l.choice)}` : `- ${l.name}: no flight (${l.note ?? "none found"})`));
      return {
        content: [
          `Group plan shown with a "Hold seats" button. ${block.coordinator.rationale ?? ""} ${block.coordinator.checked ?? ""}`.trim(),
          `Arrivals span ${block.coordinator.spreadMinutes} min (window ${block.windowMinutes}).`,
          ...lines,
          "Holding prices each flight with its airline and gives each traveller their own checkout link; nobody is charged until they pay their own.",
        ].join("\n"),
        detail: `${block.coordinator.spreadMinutes} min apart`,
      };
    } catch (e) {
      return failure(e);
    }
  },
};

/** Not offered to the model: the Hold button runs it. Prices every chosen flight and opens a checkout link per traveller. */
export const holdGroup: Tool = {
  schema: { type: "function", function: { name: "hold_group", description: "Internal: runs on the Hold press.", parameters: { type: "object", properties: {} } } },
  label: () => "Holding everyone's seats with the airlines",
  async run(a, ctx) {
    const s = ctx.session;
    const g = s.groups.get(str(a.blockId));
    if (!g) return { content: "ERROR: that group plan is no longer here; plan it again." };
    const b = g.block;
    const base = str(a.baseUrl);
    b.holding = true;
    const publish = () => ctx.emit({ type: "patch", block: structuredClone(b) });
    publish();
    step(ctx, "choose", "done", `Plan · ${b.coordinator.spreadMinutes} min apart`);
    step(ctx, "price", "running", undefined, "Every airline is confirming its price");
    await Promise.all(
      b.lanes.map(async (lane) => {
        if (!lane.choice || lane.hold?.url) return;
        const stored = g.options.get(lane.choice.ref);
        if (!stored) return;
        try {
          const priced = await norba().price(stored.offer);
          const c = await openCheckout(priced, slotsFor(1), "group", `${lane.name}'s flight · ${b.title}`);
          lane.hold = { url: `${base}/pay/${c.token}`, total: c.total, currency: c.currency, until: priced.price_guaranteed_until };
          // When they pay — maybe hours later, on their own phone — the chat hears of it on its next poll.
          onPaid(c.token, (paid) => {
            lane.hold = { ...lane.hold!, paid: true, pnr: paid.order?.pnr };
            if (paid.order) keepOrder(s, paid.order);
            pushUpdate(s, { type: "patch", block: structuredClone(b) });
            const n = b.lanes.filter((l) => l.hold?.paid).length;
            const quiet = { session: s, emit: (e: Parameters<ToolContext["emit"]>[0]) => pushUpdate(s, e) };
            step(quiet, "booking", n === b.lanes.length ? "done" : "waiting", `${n} of ${b.lanes.length} paid`);
            if (n === b.lanes.length) step(quiet, "tickets", "done", `${n} bookings`, "Everyone is booked");
          });
        } catch (e) {
          lane.hold = { url: "", total: 0, currency: b.currency, error: failure(e).content.replace(/^ERROR[^:]*:\s*/, "") };
        }
        publish();
      }),
    );
    b.holding = false;
    publish();
    const held = b.lanes.filter((l) => l.hold?.url);
    step(ctx, "price", "done", `${held.length} of ${b.lanes.length} held`);
    for (const id of ["seats", "extras", "travellers", "review", "payment"] as const) step(ctx, id, "skipped", "On each traveller's own link");
    step(ctx, "booking", "waiting", `0 of ${b.lanes.length} paid`, "Each traveller pays on their own link");
    return {
      content: `Held ${held.length} of ${b.lanes.length}: ${held.map((l) => `${l.name} ${money(l.hold!.total, l.hold!.currency)}`).join(", ")}. Each has their own checkout link in the plan; the price holds for about 20 minutes.${b.lanes.some((l) => l.hold?.error) ? ` Not held: ${b.lanes.filter((l) => l.hold?.error).map((l) => `${l.name} (${l.hold!.error})`).join(", ")}.` : ""}`,
      detail: `${held.length}/${b.lanes.length} held`,
    };
  },
};

export const GROUP_TOOLS: Tool[] = [planGroupTrip];
