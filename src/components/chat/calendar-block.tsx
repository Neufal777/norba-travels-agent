"use client";

import { dateLabel, money } from "@/lib/format";
import type { CalendarBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sq } from "../status";
import { useChat } from "./chat-context";
import { Place } from "./place";

const searchText = (iso: string) => (typeof navigator !== "undefined" && navigator.language.startsWith("es") ? `Busca el ${dateLabel(iso, true)}` : `Search ${dateLabel(iso, true)}`);

/** Cheapest fare per day as a strip of bars; the lowest is rust, and a tap searches that day. */
export function CalendarResult({ block }: { block: CalendarBlock }) {
  const { send, busy } = useChat();
  if (!block.days.length)
    return (
      <div className="na-in flex items-start gap-3 border-t border-hr-line pt-4">
        <Sq className="mt-[7px] bg-hr-stone" />
        <p className="text-[14px] text-hr-ink-2">
          No prices known yet for <Place code={block.origin} /> → <Place code={block.destination} /> on those days.
        </p>
      </div>
    );
  const amounts = block.days.map((d) => d.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return (
    <section className="na-in border border-hr-line-strong/70 bg-hr-panel">
      <header className="flex h-10 items-center justify-between gap-3 border-b border-hr-line px-5">
        <span className="hr-eyebrow text-[10px]">
          Price per traveller · <Place code={block.origin} nameClassName="normal-case" /> → <Place code={block.destination} nameClassName="normal-case" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3">from {money(min, block.currency)}</span>
      </header>
      <div className="overflow-x-auto px-5 pb-4 pt-5">
        <ol className="flex min-w-max items-end gap-1">
          {block.days.map((d, i) => {
            const h = max === min ? 60 : 18 + ((d.amount - min) / (max - min)) * 82;
            const low = d.amount === min;
            const first = i === 0 || d.date.slice(8) === "01";
            return (
              <li key={d.date} className="flex w-8 flex-col items-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send(searchText(d.date))}
                  title={`${dateLabel(d.date, true)} · ${money(d.amount, block.currency)}`}
                  className="group/day flex h-28 w-full cursor-pointer flex-col items-center justify-end gap-1 disabled:cursor-default"
                >
                  <span className={cn("font-mono text-[9px] tabular-nums opacity-0 transition-opacity duration-300 group-hover/day:opacity-100", low && "opacity-100 text-hr-rust")}>
                    {Math.round(d.amount)}
                  </span>
                  <span
                    className={cn("na-in w-5 transition-colors duration-300", low ? "bg-hr-rust" : "bg-viz-3 group-hover/day:bg-hr-ink-strong")}
                    style={{ height: `${h}%`, animationDelay: `${i * 18}ms` }}
                  />
                </button>
                <span className={cn("mt-1.5 font-mono text-[10px] tabular-nums", low ? "text-hr-ink-strong" : "text-hr-ink-3")}>{Number(d.date.slice(8))}</span>
                <span className="h-3 font-mono text-[9px] uppercase text-hr-ink-4">{first ? dateLabel(d.date).split(" ")[2] : ""}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
