import "server-only";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, duration, money } from "@/lib/format";
import { groupItineraries, sortItineraries } from "@/lib/offers";
import type { CabinClass, Offer } from "@/lib/types";
import { brainMode } from "./config";
import { modelLabel, structured } from "./llm/meta";
import type { ContentPart } from "./llm/types";
import { openCheckout, slotsFor } from "./checkout";
import { norba } from "./norba";

/*
 * The agency desk: the same agent, for a travel agency's staff, on the same model as the chat. A client's request
 * arrives by email or chat; Muse Spark reads it, Norba searches, Muse Spark checks every option against the client
 * company's travel policy and drafts the reply. The person at the desk approves one option, which becomes a checkout
 * link for the client.
 */

export type DeskStep = { id: string; label: string; status: "running" | "done" | "failed"; detail?: string; model?: string };

export type DeskOption = {
  ref: string;
  airline: string;
  cabin: CabinClass;
  total: number;
  currency: string;
  outbound: Offer["slices"][number];
  inbound?: Offer["slices"][number];
  compliant: boolean;
  violations: string[];
};

export type DeskReading = { traveller_name: string; origin: string; destination: string; depart_date: string; return_date: string | null; adults: number; cabin: CabinClass; notes: string };

export type DeskEvent =
  | { type: "step"; step: DeskStep }
  | { type: "reading"; reading: DeskReading }
  | { type: "options"; options: DeskOption[]; summary: string }
  | { type: "reply"; subject: string; body: string }
  | { type: "draft"; draftId: string }
  | { type: "error"; message: string };

type Draft = { offers: Map<string, Offer>; adults: number; traveller: string; at: number };
const store = globalThis as unknown as { __naDesk?: Map<string, Draft> };
const drafts = (store.__naDesk ??= new Map<string, Draft>());

const label = () => modelLabel();

const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"];

function optionLine(o: DeskOption) {
  const back = o.inbound ? `, back ${dateLabel(o.inbound.departure_utc.slice(0, 10))} ${clock(o.inbound.departure_utc)}` : "";
  return `${o.ref}: ${airlineName(o.airline)}, ${o.cabin.replace("_", " ")}, ${dateLabel(o.outbound.departure_utc.slice(0, 10))} ${clock(o.outbound.departure_utc)} ${o.outbound.origin} → ${clock(o.outbound.arrival_utc)} ${o.outbound.destination}, ${duration(o.outbound.duration_minutes)} in the air, ${o.outbound.stops ? `${o.outbound.stops} stop` : "non-stop"}${back}, ${money(o.total, o.currency)}`;
}

/** Reads a request, searches, checks the policy and drafts the reply, telling the desk each step as it goes. */
export async function draft(request: string, policy: { text?: string; pdf?: string; name?: string }, today: string, emit: (e: DeskEvent) => void, signal?: AbortSignal) {
  const model = label();
  const run = async <T>(id: string, text: string, fn: () => Promise<T>, detail?: (r: T) => string, m?: string) => {
    emit({ type: "step", step: { id, label: text, status: "running", model: m } });
    try {
      const r = await fn();
      emit({ type: "step", step: { id, label: text, status: "done", detail: detail?.(r), model: m } });
      return r;
    } catch (e) {
      emit({ type: "step", step: { id, label: text, status: "failed", detail: (e as Error).message.slice(0, 160), model: m } });
      throw e;
    }
  };

  // A policy sent as a PDF is read first, by Muse Spark's vision, into plain rules.
  let rules = policy.text?.trim() ?? "";
  if (policy.pdf) {
    const part: ContentPart = { type: "file", file: { filename: policy.name || "policy.pdf", file_data: policy.pdf } };
    const r = await run(
      "policy",
      "Reading the travel policy PDF",
      () =>
        structured<{ rules: string }>(
          [{ role: "user", content: [{ type: "text", text: "Write this company travel policy as short plain rules about flights: cabin by duration, price caps, booking window, preferred airlines, anything else that decides whether a flight is allowed." }, part] }],
          "policy_rules",
          { type: "object", additionalProperties: false, required: ["rules"], properties: { rules: { type: "string" } } },
          { signal },
        ),
      () => "rules extracted",
      `${modelLabel()} · vision`,
    );
    rules = r.rules;
  }

  const reading = await run(
    "read",
    "Reading the client's request",
    () =>
      structured<DeskReading>(
        [
          { role: "system", content: `You read travel requests sent to a travel agency. Today is ${today}. A date without a year is its next occurrence. Dates as YYYY-MM-DD. Cities as written; the agency resolves them.` },
          { role: "user", content: request },
        ],
        "trip_request_reading",
        {
          type: "object",
          additionalProperties: false,
          required: ["traveller_name", "origin", "destination", "depart_date", "return_date", "adults", "cabin", "notes"],
          properties: {
            traveller_name: { type: "string" },
            origin: { type: "string" },
            destination: { type: "string" },
            depart_date: { type: "string" },
            return_date: { type: ["string", "null"] },
            adults: { type: "integer" },
            cabin: { type: "string", enum: CABINS },
            notes: { type: "string", description: "Constraints that matter for the flight: meeting times, preferences" },
          },
        },
        { signal },
      ),
    (r) => `${r.traveller_name} · ${r.origin} → ${r.destination} · ${r.depart_date}${r.return_date ? `–${r.return_date}` : ""} · ${r.cabin.replace("_", " ")}`,
    model,
  );
  emit({ type: "reading", reading });

  const code = async (place: string) => (/^[A-Za-z]{3}$/.test(place.trim()) ? place.trim().toUpperCase() : ((await norba().airports(place))[0]?.iata_code ?? place.toUpperCase()));
  const [origin, destination] = await Promise.all([code(reading.origin), code(reading.destination)]);
  const adults = Math.max(1, Math.min(9, reading.adults || 1));
  // A premium cabin is searched with economy beside it: when the policy says no, there is something to offer instead.
  const cabins: CabinClass[] = reading.cabin === "economy" ? ["economy"] : [reading.cabin, "economy"];
  const offers = await run(
    "search",
    `Searching ${origin} → ${destination} with Norba`,
    async () =>
      (
        await Promise.all(
          cabins.map(async (cabin) => (await norba().search({ origin, destination, departure_date: reading.depart_date, return_date: reading.return_date ?? undefined, adults, cabin_class: cabin }, () => {}, signal)).offers.map((o) => ({ o, cabin }))),
        )
      ).flat(),
    (r) => `${r.length} offers`,
  );

  const id = crypto.randomUUID();
  const kept = new Map<string, Offer>();
  let n = 0;
  const options: DeskOption[] = [];
  for (const cabin of cabins) {
    const its = sortItineraries(groupItineraries(offers.filter((x) => x.cabin === cabin).map((x) => x.o)), "best").slice(0, cabin === reading.cabin ? 4 : 3);
    for (const it of its) {
      const ref = `p${++n}`;
      kept.set(ref, it.cheapest);
      options.push({ ref, airline: it.cheapest.airline, cabin, total: it.cheapest.total_amount, currency: it.cheapest.currency, outbound: it.cheapest.slices[0], inbound: it.cheapest.slices[1], compliant: true, violations: [] });
    }
  }
  if (!options.length) throw new Error("No airline returned flights for this request.");
  drafts.set(id, { offers: kept, adults, traveller: reading.traveller_name, at: Date.now() });

  const check = await run(
    "policy-check",
    "Checking every option against the travel policy",
    () =>
      structured<{ verdicts: { ref: string; compliant: boolean; violations: string[] }[]; summary: string }>(
        [
          { role: "system", content: "You check flight options against a company travel policy, strictly and only by its rules. A violation is a short sentence naming the rule broken. When the policy says nothing about something, it is allowed." },
          { role: "user", content: `TRAVEL POLICY\n${rules || "(none given: everything is allowed)"}\n\nREQUEST NOTES\n${reading.notes || "none"}\n\nOPTIONS\n${options.map((o) => `- ${optionLine(o)}`).join("\n")}` },
        ],
        "policy_check",
        {
          type: "object",
          additionalProperties: false,
          required: ["verdicts", "summary"],
          properties: {
            verdicts: { type: "array", items: { type: "object", additionalProperties: false, required: ["ref", "compliant", "violations"], properties: { ref: { type: "string" }, compliant: { type: "boolean" }, violations: { type: "array", items: { type: "string" } } } } },
            summary: { type: "string", description: "One sentence for the agent at the desk" },
          },
        },
        { signal },
      ),
    (r) => `${r.verdicts.filter((v) => v.compliant).length} of ${options.length} within policy`,
    model,
  );
  for (const v of check.verdicts) {
    const o = options.find((x) => x.ref === v.ref);
    if (o) Object.assign(o, { compliant: v.compliant, violations: v.violations });
  }
  emit({ type: "options", options, summary: check.summary });

  const reply = await run(
    "reply",
    "Drafting the reply to the client",
    () =>
      structured<{ subject: string; body: string }>(
        [
          { role: "system", content: "You write short, warm replies from a travel agency to its client. Offer the policy-compliant options (at most three, best first, with times and prices), preferring those whose times match what the client asked (an evening return, a meeting to reach); if none match, say so in one sentence. Say plainly why a requested option is not offered when the policy rules it out, and end by saying a payment link follows once they choose. No placeholders." },
          { role: "user", content: `Client: ${reading.traveller_name}\nRequest: ${request}\nCompliant options:\n${options.filter((o) => o.compliant).map((o) => `- ${optionLine(o)}`).join("\n") || "none"}\nRuled out by policy:\n${options.filter((o) => !o.compliant).map((o) => `- ${optionLine(o)}: ${o.violations.join("; ")}`).join("\n") || "none"}` },
        ],
        "agency_reply",
        { type: "object", additionalProperties: false, required: ["subject", "body"], properties: { subject: { type: "string" }, body: { type: "string" } } },
        { signal },
      ),
    () => "ready to send",
    model,
  );
  emit({ type: "reply", subject: reply.subject, body: reply.body });
  emit({ type: "draft", draftId: id });
}

/** The desk approves an option: the airline confirms the price and the client gets a checkout link. */
export async function approve(draftId: string, ref: string, base: string) {
  const d = drafts.get(draftId);
  const offer = d?.offers.get(ref);
  if (!d || !offer) throw new Error("That draft is no longer here; draft it again.");
  const priced = await norba().price(offer);
  const c = await openCheckout(priced, slotsFor(d.adults), "agency", `${d.traveller} · prepared by your travel agency`);
  return { url: `${base}/pay/${c.token}`, total: c.total, currency: c.currency, until: priced.price_guaranteed_until };
}

export const deskModel = () => ({ mode: brainMode(), label: label() });
