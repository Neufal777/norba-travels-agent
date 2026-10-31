"use client";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, dayPart, money } from "@/lib/format";
import type { BookingBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { Check, Sq } from "../status";
import { useChat } from "./chat-context";
import { Place } from "./place";

/** The order the airline made: booking reference, status, the travellers' e-tickets and the flights. */
export function BookingResult({ block }: { block: BookingBlock }) {
  const { conversationId, busy } = useChat();
  const o = block.order;
  const id = conversationId();
  const name = (pid?: string) => {
    const p = o.passengers?.find((x) => x.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : pid;
  };
  return (
    <section data-step="booking tickets" className="na-in border border-hr-ink-strong bg-hr-panel shadow-[inset_2px_0_0_var(--hr-success)]">
      <header className="flex h-9 items-center gap-3 border-b border-hr-line px-4">
        <Check className="text-hr-success" />
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-strong">Booked with {airlineName(o.airline)}</span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3">
          {o.status}
          {o.environment === "sandbox" && " · sandbox"}
        </span>
      </header>
      {block.outcomeUnknown && (
        <p className="flex items-start gap-3 border-b border-hr-line bg-hr-alert/8 px-5 py-3 text-[13px] text-hr-alert">
          <Sq className="mt-[6px] bg-hr-alert" /> The payment answer was lost: the card may have been charged. Do not pay again — contact support with this order.
        </p>
      )}
      <div className="grid gap-6 px-4 py-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <p className="hr-eyebrow text-[10px]">Booking reference</p>
          <p className="mt-2 font-mono text-[34px] leading-none tracking-[0.08em] text-hr-ink-strong">{o.pnr ?? "—"}</p>
          <p className="mt-3 font-mono text-[10px] text-hr-ink-3">{o.order_id}</p>
          {o.total_amount != null && <p className="mt-4 text-[17px] tabular-nums text-hr-ink-strong">{money(o.total_amount, o.currency ?? "EUR", { cents: true })}</p>}
        </div>
        <div className="space-y-4">
          {o.slices?.map((s, i) => (
            <p key={i} className="text-[13px] text-hr-ink-strong">
              <span className="hr-eyebrow mr-3 text-[10px]">{dateLabel(dayPart(s.departure_utc))}</span>
              <span className="tabular-nums">{clock(s.departure_utc)}</span> <Place code={s.origin} nameClassName="text-hr-ink-3" /> → <span className="tabular-nums">{clock(s.arrival_utc)}</span> <Place code={s.destination} nameClassName="text-hr-ink-3" />
              <span className="ml-2 text-[12px] text-hr-ink-3">{s.segments.map((g) => g.flight_number).join(" + ")}</span>
            </p>
          ))}
          {(o.tickets?.length ?? 0) > 0 && (
            <ul className="divide-y divide-hr-line border-y border-hr-line">
              {o.tickets!.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-2 text-[13px]">
                  <span className="text-hr-ink-strong">{name(t.passenger_id)}</span>
                  <span className={cn("font-mono text-[12px] tabular-nums", t.status === "issued" ? "text-hr-ink-strong" : "text-hr-ink-3")}>
                    {t.ticket_number ?? "pending"} {t.status && <span className="text-hr-ink-3">· {t.status}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* Test bookings only: the airline moving this flight, and a departure board showing it cancelled, for the demo. */}
          {o.environment !== "production" && id && (
            <button
              type="button"
              disabled={busy}
              onClick={() => fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: id, minutes: 240 }) })}
              className="mr-4 inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 transition-colors hover:text-hr-ink-strong disabled:cursor-default disabled:opacity-50"
            >
              Simulate: airline moves this flight +4h
            </button>
          )}
          {o.environment !== "production" && id && (
            <a
              href={`/board?c=${encodeURIComponent(id)}&status=CANCELLED`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 no-underline transition-colors hover:text-hr-ink-strong"
            >
              Simulate: board shows it cancelled <ArrowUpRight className="size-3" />
            </a>
          )}
          {o.warnings?.map((w) => (
            <p key={w} className="text-[12px] text-hr-ink-3">
              {w}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
