"use client";

import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, money } from "@/lib/format";
import type { GroupBlock, GroupLane, GroupOption } from "@/lib/types";
import { Check, Pulse, Sq } from "../status";
import { ArrowBox, Button } from "../ui/button";
import { es, useChat } from "./chat-context";
import { Place } from "./place";

const STATUS: Record<GroupLane["status"], string> = { searching: "Searching", choosing: "Shortlisting", ready: "Ready", failed: "No flight" };

const arrival = (o: GroupOption) => Date.parse(o.outbound.arrival_utc);

/** Where everyone lands, on one line of time: a tick per traveller, the window they had to fit in shaded. */
function Arrivals({ lanes, window }: { lanes: GroupLane[]; window: number }) {
  const chosen = lanes.filter((l) => l.choice);
  if (chosen.length < 2) return null;
  const times = chosen.map((l) => arrival(l.choice!));
  const first = Math.min(...times);
  const last = Math.max(...times);
  const span = Math.max(last - first, window * 60_000) + 60 * 60_000;
  const start = first - 30 * 60_000;
  const at = (t: number) => `${((t - start) / span) * 100}%`;
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="relative h-14">
        <div aria-hidden="true" className="absolute inset-x-0 top-7 h-px bg-hr-line-strong" />
        <div aria-hidden="true" className="absolute top-5 h-[5px] bg-hr-rust/20" style={{ left: at(first), width: `${(window * 60_000 * 100) / span}%` }} />
        {chosen.map((l, i) => (
          <div key={l.id} className="na-in absolute top-0 -translate-x-1/2 text-center" style={{ left: at(arrival(l.choice!)), animationDelay: `${i * 120}ms` }}>
            <p className="whitespace-nowrap text-[10.5px] text-hr-ink-2">{l.name}</p>
            <span aria-hidden="true" className="mx-auto mt-1 block size-[7px] bg-hr-ink-strong" />
            <p className="mt-1 font-mono text-[9.5px] tabular-nums text-hr-ink-3">{clock(l.choice!.outbound.arrival_utc)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(url).then(() => (setDone(true), setTimeout(() => setDone(false), 1500)))}
      aria-label="Copy the payment link"
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 border border-hr-line-strong px-2 font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-2 transition-colors hover:border-hr-ink-strong hover:text-hr-ink-strong"
    >
      {done ? <Check className="text-hr-success" /> : <Copy className="size-3" />} {done ? "Copied" : "Copy link"}
    </button>
  );
}

function Lane({ l, b }: { l: GroupLane; b: GroupBlock }) {
  const o = l.choice;
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-grid size-4 place-items-center">{l.status === "ready" ? <Check className="text-hr-success" /> : l.status === "failed" ? <Sq className="bg-hr-alert" /> : <Pulse />}</span>
        <span className="text-[13.5px] text-hr-ink-strong">{l.name}</span>
        <span className="text-[12px] text-hr-ink-3">
          from <Place code={l.origin} />
        </span>
        {l.preferences && <span className="border border-hr-line px-1.5 py-0.5 text-[11px] text-hr-ink-3">{l.preferences}</span>}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3">{l.hold?.paid ? "Paid" : STATUS[l.status]}</span>
      </div>
      {l.status === "choosing" && <p className="pl-7 text-[12px] text-hr-ink-3">{l.name}&apos;s agent is weighing the options…</p>}
      {l.status === "failed" && <p className="pl-7 text-[12px] text-hr-alert">{l.note}</p>}
      {o ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-7">
          <p className="text-[13.5px] tabular-nums text-hr-ink-strong">
            {clock(o.outbound.departure_utc)} → {clock(o.outbound.arrival_utc)}
            <span className="ml-2 text-[11.5px] text-hr-ink-3">
              {airlineName(o.airline)} · {o.outbound.stops ? `${o.outbound.stops} stop` : "direct"}
              {o.inbound && ` · back ${clock(o.inbound.departure_utc)}`}
            </span>
          </p>
          <span className="ml-auto text-[14px] tabular-nums text-hr-ink-strong">{money(o.total, o.currency)}</span>
          {o.reason && <p className="w-full text-[11.5px] text-hr-ink-3">{o.reason}</p>}
        </div>
      ) : (
        l.shortlist.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pl-7">
            {l.shortlist.map((x) => (
              <li key={x.ref} className="na-in border border-hr-line px-2 py-1 text-[11.5px] tabular-nums text-hr-ink-2">
                lands {clock(x.outbound.arrival_utc)} · {money(x.total, x.currency)}
              </li>
            ))}
          </ul>
        )
      )}
      {l.hold && (
        <div className="flex flex-wrap items-center gap-2 pl-7">
          {l.hold.error ? (
            <p className="text-[12px] text-hr-alert">{l.hold.error}</p>
          ) : l.hold.paid ? (
            <p className="flex items-center gap-2 text-[12.5px] text-hr-success">
              <Check className="text-hr-success" /> Booked{l.hold.pnr ? ` · ${l.hold.pnr}` : ""}
            </p>
          ) : (
            <>
              <span className="text-[12px] text-hr-ink-3">Held at {money(l.hold.total, l.hold.currency, { cents: true })} · their link:</span>
              <CopyLink url={l.hold.url} />
              <a href={l.hold.url} target="_blank" rel="noreferrer" className="inline-flex h-7 cursor-pointer items-center gap-1.5 border border-hr-line-strong px-2 font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-2 no-underline transition-colors hover:border-hr-ink-strong hover:text-hr-ink-strong">
                <ExternalLink className="size-3" /> Open
              </a>
            </>
          )}
        </div>
      )}
      {!l.hold && b.coordinator.status === "done" && !o && l.status === "ready" && <p className="pl-7 text-[12px] text-hr-ink-3">Not in the plan</p>}
    </li>
  );
}

/** A group trip as it is worked out: each traveller's own agent, then the coordinator fitting them together. */
export function GroupResult({ block: b }: { block: GroupBlock }) {
  const { send, busy } = useChat();
  const total = b.lanes.reduce((a, l) => a + (l.choice?.total ?? 0), 0);
  const ready = b.coordinator.status === "done";
  const held = b.lanes.some((l) => l.hold);
  const paid = b.lanes.filter((l) => l.hold?.paid).length;
  return (
    <section className="na-in border border-hr-ink-strong bg-hr-panel" aria-label={b.title}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hr-line px-4 py-2.5">
        <span className="text-[14px] text-hr-ink-strong">{b.title}</span>
        <span className="text-[12px] text-hr-ink-3">
          {dateLabel(b.departDate)}
          {b.returnDate && ` – ${dateLabel(b.returnDate)}`} · land within {b.windowMinutes} min{b.budget ? ` · ≤ ${money(b.budget, b.currency)} each` : ""}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">{b.lanes.length} agents + coordinator</span>
      </header>
      <ul className="divide-y divide-hr-line">
        {b.lanes.map((l) => (
          <Lane key={l.id} l={l} b={b} />
        ))}
      </ul>
      <div className="border-t border-hr-line">
        <div className="flex flex-wrap items-start gap-3 px-4 pt-3">
          <span className="mt-0.5 inline-grid size-4 place-items-center">{b.coordinator.status === "done" ? <Check className="text-hr-success" /> : b.coordinator.status === "thinking" ? <Pulse /> : <Sq className="bg-hr-stone" />}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">
              Coordinator{b.coordinator.model ? ` · ${b.coordinator.model}` : ""}
              {b.coordinator.spreadMinutes != null && ` · ${b.coordinator.spreadMinutes} min apart`}
            </p>
            <p className="text-[13px] leading-snug text-hr-ink-strong">
              {b.coordinator.status === "waiting" ? "Waits for every traveller's shortlist." : b.coordinator.status === "thinking" ? "Fitting everyone's flights together…" : b.coordinator.rationale}
            </p>
            {b.coordinator.checked && <p className="text-[12px] text-hr-ink-3">{b.coordinator.checked}</p>}
          </div>
        </div>
        {ready && <Arrivals lanes={b.lanes} window={b.windowMinutes} />}
      </div>
      {ready && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hr-line px-4 py-3">
          <p className="text-[12.5px] text-hr-ink-3">
            {held ? `${paid} of ${b.lanes.length} paid` : "Each pays their own seat"} · <span className="tabular-nums text-hr-ink-strong">{money(total, b.currency)}</span> in all
          </p>
          {!held && (
            <Button size="sm" className="cursor-pointer" disabled={busy || b.holding} onClick={() => send(es() ? "Retener las plazas de todos" : "Hold everyone's seats", { kind: "group_hold", blockId: b.id })}>
              {b.holding ? "Holding…" : "Hold seats for everyone"} <ArrowBox />
            </Button>
          )}
        </footer>
      )}
    </section>
  );
}
