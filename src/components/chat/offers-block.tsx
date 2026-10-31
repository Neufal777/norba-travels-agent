"use client";

import { useMemo, useState } from "react";
import { groupItineraries, sortItineraries, tagOffers, type SortKey } from "@/lib/offers";
import type { OffersBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Pulse, Sq } from "../status";
import { useChat } from "./chat-context";
import { ItineraryCard } from "./itinerary-card";
import { Fold, ReceiptRow, useAutoCollapse } from "./step-card";
import { Toggle } from "./trip-panel";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "best", label: "Best" },
  { key: "cheapest", label: "Cheapest" },
  { key: "fastest", label: "Fastest" },
  { key: "earliest", label: "Earliest" },
];

/** Cards shown before "Show all": enough to compare, few enough to read. */
const FIRST = 3;

/** A placeholder card while the airlines answer: a square keeps crossing the flight line. */
function Waiting({ index }: { index: number }) {
  return (
    <div className="na-in border border-hr-line-strong/50 bg-hr-panel" style={{ animationDelay: `${index * 120}ms` }}>
      <div className="flex h-10 items-center gap-3 border-b border-hr-line px-5">
        <Skeleton className="h-[22px] w-[30px]" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 px-5 py-6">
        <Skeleton className="h-6 w-14" />
        <div className="na-route" data-live="true" />
        <Skeleton className="h-6 w-14" />
      </div>
    </div>
  );
}

export function OffersResult({ block }: { block: OffersBlock }) {
  const { trip, latestOffers } = useChat();
  const choose = trip.steps.choose;
  // Open while it is the list to choose from; folded once a flight is chosen or a newer list replaces it.
  const [open, toggle] = useAutoCollapse(block.streaming || (block.id === latestOffers && choose.status !== "done"));
  // A filtered view arrives already ordered the way the traveller asked.
  const [sort, setSort] = useState<SortKey>(block.filter?.includes("sorted by ") ? (block.filter.match(/sorted by (\w+)/)![1] as SortKey) : "best");
  const [all, setAll] = useState(false);
  const its = useMemo(() => groupItineraries(block.offers), [block.offers]);
  const sorted = useMemo(() => (its.length ? sortItineraries(its, sort) : []), [its, sort]);
  const tags = useMemo(() => tagOffers(block.offers), [block.offers]);
  const shown = all ? sorted : sorted.slice(0, FIRST);

  const chosenHere = choose.status === "done" && block.offers.some((o) => choose.summary?.startsWith(`${block.refs[o.offer_id]} `));

  return (
    <section data-step="search choose" className="na-in" aria-label={block.title}>
      {!open && (
        <ReceiptRow
          status={chosenHere ? "done" : "skipped"}
          title={block.filter ? "Filtered results" : "Results"}
          summary={chosenHere ? `Chosen ${choose.summary}` : `${block.title} · ${its.length} options${block.filter ? ` · ${block.filter}` : ""}`}
          onOpen={toggle}
        />
      )}
      <Fold open={open}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex min-w-0 items-baseline gap-3">
              <h3 className="truncate text-[14px] text-hr-ink-strong">{block.title}</h3>
              <span className="flex shrink-0 items-center gap-2 text-[12px] text-hr-ink-3">
                {block.streaming ? (
                  <>
                    <Pulse /> Asking the airlines
                  </>
                ) : (
                  `${its.length} option${its.length === 1 ? "" : "s"}${block.filter ? ` · ${block.filter}` : ""}`
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {its.length > 1 && (
                <div className="flex items-center gap-3" role="group" aria-label="Sort">
                  {SORTS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={sort === s.key}
                      onClick={() => setSort(s.key)}
                      className={cn(
                        "cursor-pointer border-b py-0.5 text-[12px] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hr-rust",
                        sort === s.key ? "border-hr-rust text-hr-ink-strong" : "border-transparent text-hr-ink-3 hover:text-hr-ink-strong",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {!block.streaming && (
                <button type="button" aria-label="Fold the results" aria-expanded onClick={toggle} className="grid size-6 cursor-pointer place-items-center text-hr-ink-3 transition-colors hover:text-hr-ink-strong">
                  <Toggle open />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {shown.map((it, i) => (
              <ItineraryCard key={it.key} it={it} refs={block.refs} tags={tags[it.cheapest.offer_id] ?? []} index={i} />
            ))}
            {block.streaming && Array.from({ length: Math.max(1, 3 - shown.length) }, (_, i) => <Waiting key={`w${i}`} index={i} />)}
            {!block.streaming && !its.length && (
              <div className="flex items-start gap-3 border-t border-hr-line pt-4">
                <Sq className="mt-[7px] bg-hr-stone" />
                <p className="text-[14px] text-hr-ink-2">{block.filter ? "Nothing matches these filters." : "No airline returned flights for this search."}</p>
              </div>
            )}
          </div>

          {!block.streaming && sorted.length > FIRST && (
            <Button variant="ghost" size="sm" onClick={() => setAll(!all)} className="cursor-pointer">
              {all ? "Show fewer" : `Show all ${sorted.length}`}
            </Button>
          )}
        </div>
      </Fold>
    </section>
  );
}
