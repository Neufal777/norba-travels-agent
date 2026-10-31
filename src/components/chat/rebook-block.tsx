"use client";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, dayPart, duration, money } from "@/lib/format";
import type { RebookBlock, Slice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Sq } from "../status";
import { ArrowBox, Button } from "../ui/button";
import { es, useChat } from "./chat-context";
import { Place } from "./place";

function Flight({ s, muted }: { s: Slice; muted?: boolean }) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-[13.5px] tabular-nums", muted ? "text-hr-ink-3 line-through decoration-hr-rust/70" : "text-hr-ink-strong")}>
      <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3 no-underline">{dateLabel(dayPart(s.departure_utc))}</span>
      <span>
        {clock(s.departure_utc)} <Place code={s.origin} className="text-[10px] text-hr-ink-3" nameClassName="text-[11px]" />
      </span>
      <span className="text-hr-ink-3">→</span>
      <span>
        {clock(s.arrival_utc)} <Place code={s.destination} className="text-[10px] text-hr-ink-3" nameClassName="text-[11px]" />
      </span>
      <span className="font-mono text-[10.5px] text-hr-ink-3">
        {s.segments.map((g) => g.flight_number).join(" · ")} · {duration(s.duration_minutes)}
        {s.stops ? ` · ${s.stops} stop` : " · direct"}
      </span>
    </p>
  );
}

/** Other flights for a disrupted booking. Switch is the traveller's consent; the agent never changes a booking alone. */
export function RebookResult({ block }: { block: RebookBlock }) {
  const { send, busy } = useChat();
  const done = Boolean(block.switched);
  return (
    <section className="na-in border border-hr-ink-strong bg-hr-panel shadow-[inset_2px_0_0_var(--hr-rust)]" aria-label="Other flights">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hr-line px-4 py-2.5">
        <Sq className={done ? "bg-hr-success" : "bg-hr-rust"} />
        <span className="text-[13px] text-hr-ink-strong">{block.reason}</span>
        {block.pnr && <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">Booking {block.pnr}</span>}
      </header>
      <div className="space-y-1 border-b border-hr-line px-4 py-2.5">
        <p className="hr-eyebrow text-[9.5px]">Booked</p>
        <Flight s={block.current} muted />
      </div>
      <ul className="divide-y divide-hr-line">
        {block.options.map((o) => {
          const taken = block.switched === o.offerId;
          return (
            <li key={o.offerId} data-refs={o.ref} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 transition-colors duration-500", taken && "bg-hr-highlight")}>
              <span className="w-6 font-mono text-[10.5px] text-hr-ink-3">{o.ref}</span>
              <div className="min-w-0 flex-1">
                <Flight s={o.slice} />
                <p className="text-[11px] text-hr-ink-3">{airlineName(o.airline)}</p>
              </div>
              <span className={cn("font-mono text-[11.5px] tabular-nums", o.amount > 0 ? "text-hr-ink-2" : "text-hr-success")}>
                {o.amount > 0 ? `+${money(o.amount, o.currency)}` : o.amount < 0 ? `${money(o.amount, o.currency)} back` : "No cost"}
              </span>
              {taken ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-success">
                  <Check className="text-hr-success" /> Switched
                </span>
              ) : (
                <Button
                  size="xs"
                  className="h-7 cursor-pointer px-2.5"
                  disabled={busy || done || o.amount > 0}
                  title={o.amount > 0 ? "Paid changes are not made in the chat yet" : undefined}
                  onClick={() => send(es() ? `Cambiar a ${o.ref}` : `Switch to ${o.ref}`, { kind: "change", blockId: block.id, offerId: o.offerId })}
                >
                  Switch <ArrowBox />
                </Button>
              )}
            </li>
          );
        })}
        {!block.options.length && <li className="px-4 py-3 text-[13px] text-hr-ink-3">No other flights that day.</li>}
      </ul>
    </section>
  );
}
