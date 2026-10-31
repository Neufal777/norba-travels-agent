"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { airlineName } from "@/lib/airlines";
import { duration } from "@/lib/format";
import type { NoticeBlock, NoticeFlight } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Toggle } from "./trip-panel";
import { Place } from "./place";

/** "11 Dec 19:40 UTC" — a notice's times are UTC to the minute; the agent's sentence gives the local ones. */
const utc = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} ${d.toISOString().slice(11, 16)} UTC`;
};

function Flight({ f, gone }: { f: NoticeFlight; gone?: boolean }) {
  if (!f) return <span className="text-[12.5px] text-hr-ink-3">{gone ? "—" : "No flight"}</span>;
  return (
    <span className={cn("text-[13px] tabular-nums", gone ? "text-hr-ink-3 line-through decoration-hr-rust/70" : "text-hr-ink-strong")}>
      {f.flight_number} · <Place code={f.origin} className="text-[11px]" nameClassName="text-[11.5px]" /> {utc(f.departure_utc)} → <Place code={f.destination} className="text-[11px]" nameClassName="text-[11.5px]" /> {utc(f.arrival_utc).slice(-9)}
    </span>
  );
}

/** What the airline changed on its own, and the notice exactly as it arrived — the agent read the raw one. */
export function NoticeResult({ block }: { block: NoticeBlock }) {
  const [raw, setRaw] = useState(false);
  return (
    <section className="na-in border border-hr-rust/70 bg-hr-panel shadow-[inset_2px_0_0_var(--hr-rust)]" aria-label="Airline notice">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hr-line px-4 py-2.5">
        <BellRing className="size-3.5 text-hr-rust" />
        <span className="text-[13px] text-hr-ink-strong">{airlineName(block.airline)} changed your booking</span>
        {block.pnr && <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">{block.pnr}</span>}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">order.schedule_changed{block.simulated ? " · simulated" : ""}</span>
      </header>
      <ul className="divide-y divide-hr-line">
        {block.changes.map((c, i) => {
          const m = c.before && c.after ? Math.round((Date.parse(c.after.departure_utc) - Date.parse(c.before.departure_utc)) / 60_000) : 0;
          return (
            <li key={i} className="grid gap-1 px-4 py-2.5">
              <Flight f={c.before} gone />
              <div className="flex flex-wrap items-center gap-2">
                <Flight f={c.after} />
                {m !== 0 && <span className="border border-hr-rust/60 px-1.5 py-0.5 font-mono text-[10px] text-hr-rust">{m > 0 ? "+" : "−"}{duration(Math.abs(m))}</span>}
                {!c.after && <span className="font-mono text-[10px] uppercase text-hr-rust">Cancelled</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" aria-expanded={raw} onClick={() => setRaw(!raw)} className="flex w-full cursor-pointer items-center gap-2 border-t border-hr-line px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 transition-colors hover:text-hr-ink-strong">
        <Toggle open={raw} /> What the airline sent
      </button>
      {raw && <pre className="max-h-64 overflow-auto border-t border-hr-line bg-hr-surface-2 px-4 py-3 font-mono text-[11px] leading-[1.5] text-hr-ink-2">{block.raw}</pre>}
    </section>
  );
}
