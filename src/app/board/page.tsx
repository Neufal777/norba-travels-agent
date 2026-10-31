import type { Metadata } from "next";
import { clock, flightLabel } from "@/lib/format";
import { peek } from "@/server/agent/sessions";
import { norbaMode } from "@/server/config";
import { mockDisrupt } from "@/server/norba/mock";
import { BoardClock } from "./board-clock";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Departures", robots: { index: false } };

type Row = { time: string; flight: string; to: string; gate: string; remark: string; own?: boolean };

/** Flights around the traveller's own, on carriers that do not exist: the board is a film set, not a timetable. */
const FILLER: Omit<Row, "time">[] = [
  { flight: "XQ 412", to: "Reykjavik", gate: "B12", remark: "ON TIME" },
  { flight: "ZT 77", to: "Lisbon", gate: "A04", remark: "BOARDING" },
  { flight: "VN 2210", to: "Copenhagen", gate: "C31", remark: "ON TIME" },
  { flight: "XQ 98", to: "Vienna", gate: "B07", remark: "GATE OPEN" },
  { flight: "KY 315", to: "Marrakech", gate: "D02", remark: "DELAYED" },
  { flight: "ZT 1043", to: "Dublin", gate: "A11", remark: "ON TIME" },
  { flight: "VN 61", to: "Istanbul", gate: "C18", remark: "ON TIME" },
  { flight: "KY 708", to: "Zurich", gate: "D09", remark: "ON TIME" },
];

const shift = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/**
 * A departure board to film someone photographing: /board?c=<conversation>&status=CANCELLED shows the flight booked in
 * that conversation among others. In mock mode a CANCELLED or DELAYED status also tells the mock airline, so the
 * rebooking that follows is the one an airline owes. Without a conversation, ?flight=&to=&time= draw a row.
 */
export default async function Board({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const status = (q.status ?? "").toUpperCase().slice(0, 24);
  const which = Math.max(0, Number(q.leg ?? 0) || 0);
  const s = peek(q.c);
  let airport = q.from ?? "Departures";
  let own: Row | undefined;

  const order = s?.orders.at(-1);
  const slice = order?.slices?.[Math.min(which, (order.slices?.length ?? 1) - 1)];
  if (order && slice) {
    const g = slice.segments[0];
    airport = s!.places.get(slice.origin) ?? slice.origin;
    own = { time: clock(g.departure_utc), flight: flightLabel(g.marketing_carrier ?? order.airline, g.flight_number), to: s!.places.get(g.destination) ?? g.destination, gate: "B22", remark: status || "ON TIME", own: true };
    if (status && norbaMode() === "mock" && /CANCEL|DELAY/.test(status)) {
      try {
        mockDisrupt(order.order_id, order.slices!.indexOf(slice), "cancelled");
      } catch {}
    }
  } else if (q.flight) {
    own = { time: q.time ?? "19:40", flight: q.flight.toUpperCase(), to: q.to ?? "Athens", gate: "B22", remark: status || "ON TIME", own: true };
  }

  const anchor = own?.time ?? "18:00";
  const rows: Row[] = FILLER.map((f, i) => ({ ...f, time: shift(anchor, (i - 3) * 15 + (i % 2) * 5) }));
  if (own) rows.splice(3, 0, own);

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-[#050505] font-mono text-[#ffb400]">
      <div className="flex h-full flex-col px-[3vw] py-[3vh]">
        <header className="flex items-end justify-between border-b-2 border-[#ffb400]/40 pb-[1.5vh]">
          <div>
            <p className="text-[2.2vw] font-semibold uppercase tracking-[0.12em]">Departures</p>
            <p className="text-[1.3vw] uppercase tracking-[0.08em] text-[#ffb400]/70">{airport}</p>
          </div>
          <BoardClock />
        </header>
        <div className="grid grid-cols-[10%_14%_minmax(0,1fr)_10%_22%] gap-x-[1.5vw] border-b border-[#ffb400]/25 py-[1.2vh] text-[1.05vw] uppercase tracking-[0.1em] text-[#ffb400]/60">
          <span>Time</span>
          <span>Flight</span>
          <span>Destination</span>
          <span>Gate</span>
          <span>Remarks</span>
        </div>
        <ol className="flex-1">
          {rows.map((r, i) => (
            <li
              key={i}
              className={`grid grid-cols-[10%_14%_minmax(0,1fr)_10%_22%] items-center gap-x-[1.5vw] border-b border-[#ffb400]/12 py-[1.35vh] text-[2.05vw] uppercase tracking-[0.06em] ${i % 2 ? "bg-white/[0.02]" : ""}`}
            >
              <span className="tabular-nums">{r.time}</span>
              <span>{r.flight}</span>
              <span className="truncate">{r.to}</span>
              <span>{r.gate}</span>
              <span className={/CANCEL/.test(r.remark) ? "na-board-blink text-[#ff3b30]" : /DELAY/.test(r.remark) ? "text-[#ff8a00]" : /BOARD|GATE/.test(r.remark) ? "text-[#7dff9a]" : ""}>{r.remark}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
