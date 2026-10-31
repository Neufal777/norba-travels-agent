"use client";

import { useState } from "react";
import { ChevronDown, Luggage, RefreshCcw, Undo2 } from "lucide-react";
import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, dayPart, dayShift, duration, money } from "@/lib/format";
import type { Itinerary } from "@/lib/offers";
import type { FareBenefit, Offer, OfferTag, SearchRequest, Slice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowBox, Button } from "../ui/button";
import { Check, Sq } from "../status";
import { useChat } from "./chat-context";
import { Place } from "./place";

const TAG_LABEL: Record<OfferTag, string> = { cheapest: "Cheapest", fastest: "Fastest", best: "Best value" };

const BENEFIT_LABEL: Record<string, string> = {
  carry_on: "Cabin bag",
  checked_bag: "Checked bag",
  seat_selection: "Seat choice",
  changes: "Changes",
  refund: "Refund",
  lounge: "Lounge",
  priority_boarding: "Priority boarding",
  miles_accrual: "Miles",
  meal: "Meal",
  wifi: "Wi-Fi",
  fast_track: "Fast track",
};

export function paxLabel(r: SearchRequest) {
  const n = r.adults + (r.children ?? 0) + (r.infants ?? 0);
  return n === 1 ? "1 traveller" : `${n} travellers`;
}

/** "Book o4" in the traveller's browser language, sent as their own message: the agent takes it from there. */
const chooseText = (ref: string) => (typeof navigator !== "undefined" && navigator.language.startsWith("es") ? `Quiero reservar ${ref}` : `I'll book ${ref}`);

function AirlineBox({ code }: { code: string }) {
  return <span className="inline-grid h-[18px] min-w-[26px] place-items-center border border-hr-line-strong px-1 font-mono text-[9.5px] tracking-[0.04em] text-hr-ink-strong">{code}</span>;
}

/** A small aircraft seen from above, nose to the right: where the line lands. */
function PlaneGlyph() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0 text-hr-ink-3 transition-colors duration-300 group-hover:text-hr-rust">
      <path d="M11.5 6 9 5.2 6.2 1.5H5.2l1.4 3.7H3.2L2.2 3.8h-.8L2 6l-.6 2.2h.8l1-1.4h3.4l-1.4 3.7h1L9 6.8Z" fill="currentColor" />
    </svg>
  );
}

/** One direction on one line: when, departure, the flight line with its duration and stops on it, arrival. */
function SliceRow({ s, label }: { s: Slice; label?: string }) {
  const shift = dayShift(s.departure_utc, s.arrival_utc);
  const via = s.segments.slice(0, -1).map((g) => g.destination);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 sm:grid-cols-[minmax(0,4.5rem)_auto_minmax(0,1fr)_auto] sm:gap-x-3">
      <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3 sm:block" title={label}>
        {label ? `${label} · ` : ""}
        {dateLabel(dayPart(s.departure_utc)).replace(/^\w+ /, "")}
      </span>
      <p className="whitespace-nowrap text-[15px] leading-none tabular-nums text-hr-ink-strong">
        {clock(s.departure_utc)} <Place code={s.origin} className="text-[10px] text-hr-ink-3" nameClassName="text-[11px] max-sm:hidden" />
      </p>
      <div className="flex min-w-14 items-center gap-1.5" aria-label={`${duration(s.duration_minutes)}, ${s.stops ? `${s.stops} stop via ${via.join(", ")}` : "direct"}`}>
        <span aria-hidden="true" className="size-[5px] shrink-0 border border-hr-ink-3" />
        <span aria-hidden="true" className="na-dash h-px min-w-2 flex-1" />
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] leading-none tabular-nums text-hr-ink-2">
          {duration(s.duration_minutes)}
          {s.stops ? (
            via.map((v) => (
              <span key={v} className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="size-[5px] rotate-45 bg-hr-ink-strong" />
                <Place code={v} className="max-sm:hidden" nameClassName="text-[10.5px] max-lg:hidden" />
              </span>
            ))
          ) : (
            <span className="text-hr-success">direct</span>
          )}
        </span>
        <span aria-hidden="true" className="na-dash h-px min-w-2 flex-1" />
        <PlaneGlyph />
      </div>
      <p className="whitespace-nowrap text-right text-[15px] leading-none tabular-nums text-hr-ink-strong">
        {clock(s.arrival_utc)}
        {shift > 0 && <sup className="ml-0.5 font-mono text-[9px] text-hr-rust">+{shift}</sup>}{" "}
        <Place code={s.destination} className="text-[10px] text-hr-ink-3" nameClassName="text-[11px] max-sm:hidden" />
      </p>
    </div>
  );
}

function Details({ offer }: { offer: Offer }) {
  const benefits: FareBenefit[] = offer.fare_family?.benefits ?? [];
  return (
    <div className="grid gap-5 border-t border-hr-line px-3.5 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        {offer.slices.map((s, si) => (
          <ol key={si} className="space-y-0">
            {s.segments.map((g, gi) => {
              const next = s.segments[gi + 1];
              const wait = next ? Math.round((Date.parse(next.departure_utc) - Date.parse(g.arrival_utc)) / 60_000) : 0;
              return (
                <li key={gi}>
                  <div className="flex items-start gap-3">
                    <Sq className="mt-[7px] bg-hr-ink-strong" />
                    <div className="min-w-0 text-[13px] leading-[1.5]">
                      <p className="text-hr-ink-strong">
                        <span className="tabular-nums">{clock(g.departure_utc)}</span> <Place code={g.origin} nameClassName="text-hr-ink-3" />
                        {g.departure_terminal && <span className="text-hr-ink-3"> · T{g.departure_terminal}</span>} → <span className="tabular-nums">{clock(g.arrival_utc)}</span> <Place code={g.destination} nameClassName="text-hr-ink-3" />
                        {g.arrival_terminal && <span className="text-hr-ink-3"> · T{g.arrival_terminal}</span>}
                      </p>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-hr-ink-3">
                        {g.flight_number} · {airlineName(g.operating_carrier || g.marketing_carrier || offer.airline)}
                        {g.aircraft && ` · ${g.aircraft}`}
                        {g.duration_minutes ? ` · ${duration(g.duration_minutes)}` : ""}
                      </p>
                    </div>
                  </div>
                  {next && (
                    <p className="my-2 ml-[3px] border-l border-dashed border-hr-line-strong py-1 pl-5 text-[12px] text-hr-ink-3">
                      Change at <Place code={g.destination} /> · {duration(wait)}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        ))}
      </div>
      <div>
        <p className="hr-eyebrow mb-3 text-[10px]">{offer.fare_family?.name ? `${offer.fare_family.name} fare` : "Fare"}</p>
        <ul className="space-y-2">
          {benefits.map((b) => (
            <li key={b.type} className={cn("flex items-center gap-2.5 text-[13px]", b.included ? "text-hr-ink-strong" : "text-hr-ink-3 line-through decoration-hr-line-strong")}>
              {b.included ? <Check className="text-hr-success" /> : <span aria-hidden="true" className="inline-block size-3.5 shrink-0" />}
              {BENEFIT_LABEL[b.type] ?? b.description ?? b.type}
              {b.value && <span className="font-mono text-[10px] text-hr-ink-3">{b.value}</span>}
            </li>
          ))}
          {offer.fare_rules?.refundable != null && (
            <li className="flex items-center gap-2.5 text-[13px] text-hr-ink-2">
              <Undo2 className="size-3.5" /> {offer.fare_rules.refundable ? "Refundable" : "Non-refundable"}
            </li>
          )}
          {offer.fare_rules?.changeable && (
            <li className="flex items-center gap-2.5 text-[13px] text-hr-ink-2">
              <RefreshCcw className="size-3.5" /> Changeable
            </li>
          )}
          {!benefits.length && offer.fare_rules?.refundable == null && <li className="text-[13px] text-hr-ink-3">The airline sent no fare details.</li>}
        </ul>
      </div>
    </div>
  );
}

export function ItineraryCard({
  it,
  refs,
  tags,
  index,
}: {
  it: Itinerary;
  refs: Record<string, string>;
  tags: OfferTag[];
  index: number;
}) {
  const { send, busy, trip } = useChat();
  const [chosen, setChosen] = useState(it.cheapest.offer_id);
  const [open, setOpen] = useState(false);
  const offer = it.offers.find((o) => o.offer_id === chosen) ?? it.cheapest;
  const ref = refs[offer.offer_id];
  const allRefs = it.offers.map((o) => refs[o.offer_id]).filter(Boolean).join(" ");

  return (
    <article
      data-refs={allRefs}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="na-in group border border-hr-line-strong/70 bg-hr-panel transition-[border-color] duration-500 ease-hr-soft hover:border-hr-ink-strong"
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_10.5rem]">
        <div className="min-w-0 space-y-2 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <AirlineBox code={offer.airline} />
            <span className="truncate text-[12.5px] text-hr-ink-strong">{airlineName(offer.airline)}</span>
            <span className="ml-auto flex shrink-0 items-center gap-2.5">
              {tags.map((t, i) => (
                <span key={t} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.04em] text-hr-ink-strong", i > 0 && "max-sm:hidden")}>
                  <Sq size={5} className={t === "cheapest" ? "bg-hr-success" : t === "fastest" ? "bg-hr-ink-strong" : "bg-hr-rust"} />
                  {TAG_LABEL[t]}
                </span>
              ))}
              {ref && <span className="font-mono text-[10.5px] text-hr-ink-3">{ref}</span>}
            </span>
          </div>

          {/* Phones have no room for names in the rows: the route, named, goes on a line of its own. */}
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-hr-ink-3 sm:hidden">
            <Place code={offer.slices[0].origin} />
            {offer.slices[0].segments.slice(0, -1).map((g) => (
              <span key={g.destination}>
                → <Place code={g.destination} />
              </span>
            ))}
            → <Place code={offer.slices[0].destination} />
            {offer.slices.length === 2 && offer.slices[1].destination === offer.slices[0].origin && <span>· return</span>}
          </p>

          <div className="space-y-2">
            {offer.slices.map((s, i) => (
              <SliceRow key={i} s={s} label={offer.slices.length > 1 ? (offer.slices.length === 2 ? (i ? "Ret" : "Out") : `F${i + 1}`) : undefined} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {it.offers.length > 1 && (
              <div className="flex border border-hr-line" role="radiogroup" aria-label="Fare">
                {it.offers.map((o) => (
                  <button
                    key={o.offer_id}
                    type="button"
                    role="radio"
                    aria-checked={o.offer_id === chosen}
                    onClick={() => setChosen(o.offer_id)}
                    title={`${o.fare_family?.name ?? "Fare"} · ${money(o.total_amount, o.currency)}${o.baggage_included ? " · checked bag" : ""}`}
                    className={cn(
                      "inline-flex h-6 cursor-pointer items-center gap-1.5 border-r border-hr-line px-2 text-[11px] transition-colors duration-300 last:border-r-0",
                      o.offer_id === chosen ? "bg-hr-ink-strong text-hr-surface" : "text-hr-ink-2 hover:bg-hr-highlight hover:text-hr-ink-strong",
                    )}
                  >
                    {o.fare_family?.name ?? "Fare"}
                    {o.baggage_included && <Luggage className="size-3 opacity-70" aria-label="Checked bag included" />}
                    <span className="font-mono text-[10px] tabular-nums opacity-80">{money(o.total_amount, o.currency)}</span>
                  </button>
                ))}
              </div>
            )}
            {/* With fares to pick from, the bag icon on each says it; the rest of the fare is in the details. */}
            {it.offers.length === 1 && (
              <span className="inline-flex items-center gap-1 text-[10.5px] text-hr-ink-3">
                <Luggage className="size-3" /> {offer.baggage_included ? "Bag included" : "Cabin bag only"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hr-line px-3.5 py-2.5 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:border-t-0">
          <div className="sm:text-right">
            <p className="text-[19px] leading-none tracking-[-0.03em] tabular-nums text-hr-ink-strong">{money(offer.total_amount, offer.currency)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="xs" disabled={!ref || busy} onClick={() => ref && send(chooseText(ref))} className="h-7 flex-1 cursor-pointer px-2.5">
              {trip.steps.choose.status === "done" && trip.steps.choose.summary?.startsWith(`${ref} `) ? "Chosen" : "Book this"} <ArrowBox />
            </Button>
            <Button size="icon-xs" variant="outline" aria-label={open ? "Hide details" : "Show details"} aria-expanded={open} onClick={() => setOpen(!open)} className="size-7 cursor-pointer">
              <ChevronDown className={cn("transition-transform duration-300", open && "rotate-180")} />
            </Button>
          </div>
        </div>
      </div>

      {open && <Details offer={offer} />}
    </article>
  );
}
