"use client";

import { useEffect, useState } from "react";
import { airlineName } from "@/lib/airlines";
import { clock, money } from "@/lib/format";
import type { PricedBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sq } from "../status";
import { useChat } from "./chat-context";
import { Fold, ReceiptRow, useAutoCollapse } from "./step-card";
import { Toggle } from "./trip-panel";
import { Place } from "./place";

function useCountdown(until?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return undefined;
  const left = Math.max(0, Date.parse(until) - now);
  return { left, label: `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")}` };
}

/** The airline's confirmed price, how it moved since the search, and the clock it holds for. */
export function PricedResult({ block }: { block: PricedBlock }) {
  const o = block.offer;
  const t = useCountdown(o.price_guaranteed_until);
  const delta = block.previousAmount != null ? o.total_amount - block.previousAmount : 0;
  const expired = t?.left === 0;
  const { trip } = useChat();
  const current = trip.steps.price.status === "done" && Boolean(trip.steps.choose.summary?.startsWith(`${block.ref} `));
  const seatsSettled = trip.steps.seats.status === "done" || trip.steps.seats.status === "skipped";
  // Open beside the seat map; folded once seats are settled, or when another flight was chosen since.
  const [open, toggle] = useAutoCollapse(current && !seatsSettled);
  if (!open)
    return (
      <ReceiptRow
        step="price"
        status={current && !expired ? "done" : "skipped"}
        title={expired ? "Price hold ended" : "Price check"}
        summary={`${block.ref} · ${money(o.total_amount, o.currency, { cents: true })} · ${airlineName(o.airline)}`}
        onOpen={toggle}
      />
    );
  return (
    <section data-step="price" className={cn("na-in border bg-hr-panel shadow-[inset_2px_0_0_var(--hr-success)] transition-[border-color] duration-500", open ? "border-hr-ink-strong" : "border-hr-line-strong/70")}>
      <header
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
        className={cn("flex h-9 cursor-pointer items-center gap-3 px-4 outline-none transition-colors duration-300 hover:bg-hr-highlight focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hr-rust", open && "border-b border-hr-line")}
      >
        <Sq className={expired || !current ? "bg-hr-stone" : "bg-hr-success"} />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-strong">{expired ? "Price hold ended" : "Price confirmed with the airline"}</span>
        {!open && <span className="na-in min-w-0 truncate text-[12px] text-hr-ink-3">· {money(o.total_amount, o.currency, { cents: true })} · {airlineName(o.airline)}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <span className="font-mono text-[11px] text-hr-ink-3">{block.ref}</span>
          <span className="grid size-5 place-items-center text-hr-ink-3">
            <Toggle open={open} />
          </span>
        </span>
      </header>
      <Fold open={open}>
        <div className="flex flex-wrap items-end justify-between gap-6 px-4 py-4">
          <div>
            <p className="text-[26px] leading-none tracking-[-0.03em] tabular-nums text-hr-ink-strong">{money(o.total_amount, o.currency, { cents: true })}</p>
            <p className="mt-2 text-[12px] text-hr-ink-3">
              {Math.abs(delta) < 0.01 ? (
                "Same as the search"
              ) : (
                <span className={delta > 0 ? "text-hr-alert" : "text-hr-success"}>
                  {delta > 0 ? "+" : "−"}
                  {money(Math.abs(delta), o.currency, { cents: true })} since the search
                </span>
              )}
            </p>
            <p className="mt-3 text-[13px] text-hr-ink-2">
              {airlineName(o.airline)}
              {o.slices.map((s, i) => (
                <span key={i}>
                  {" · "}
                  <Place code={s.origin} nameClassName="text-hr-ink-3" /> {clock(s.departure_utc)} → <Place code={s.destination} nameClassName="text-hr-ink-3" /> {clock(s.arrival_utc)}
                </span>
              ))}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            {t && (
              <p className={cn("font-mono text-[11px] uppercase tracking-[0.04em] tabular-nums", expired ? "text-hr-alert" : "text-hr-ink-3")}>
                {expired ? "Hold ended — ask to confirm it again" : `Held for ${t.label}`}
              </p>
            )}
          </div>
        </div>
      </Fold>
    </section>
  );
}
