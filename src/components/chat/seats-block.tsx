"use client";

import { useMemo, useState } from "react";
import { airlineName } from "@/lib/airlines";
import { clock, money } from "@/lib/format";
import type { Seat, SeatsBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowBox, Button } from "../ui/button";
import { es, useChat } from "./chat-context";
import { StepCard, useEditable } from "./step-card";
import { Place } from "./place";

type Picks = Record<string, Record<string, { row: number; column: string; price: number }>>;

/** Columns with the aisles between them: from the seats' own "aisle" feature, else down the middle. */
function layout(seats: Seat[]) {
  const columns = [...new Set(seats.map((s) => s.column))].sort();
  const aisle = new Set(seats.filter((s) => s.features?.includes("aisle")).map((s) => s.column));
  const out: (string | null)[] = [];
  columns.forEach((c, i) => {
    out.push(c);
    const next = columns[i + 1];
    if (!next) return;
    if (aisle.size ? aisle.has(c) && aisle.has(next) : i === Math.floor(columns.length / 2) - 1) out.push(null);
  });
  return out;
}

function SeatButton({ seat, mine, onPick, disabled }: { seat?: Seat; mine?: string; onPick: () => void; disabled: boolean }) {
  if (!seat) return <span className="size-7" />;
  const paid = (seat.price?.amount ?? 0) > 0;
  const title = `${seat.row}${seat.column}${seat.features?.length ? ` · ${seat.features.join(", ").replace(/_/g, " ")}` : ""}${seat.available ? ` · ${paid ? money(seat.price!.amount, seat.price!.currency) : "free"}` : " · taken"}`;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={Boolean(mine)}
      disabled={!seat.available || disabled}
      onClick={onPick}
      className={cn(
        "grid size-7 place-items-center border font-mono text-[10px] transition-[background-color,border-color,transform] duration-200 active:scale-95",
        mine
          ? "cursor-pointer border-hr-rust bg-hr-rust text-white"
          : !seat.available
            ? "cursor-not-allowed border-transparent bg-[repeating-linear-gradient(45deg,var(--hr-line)_0_2px,transparent_2px_5px)]"
            : paid
              ? "cursor-pointer border-hr-line-strong bg-hr-signal hover:border-hr-ink-strong"
              : "cursor-pointer border-hr-line-strong bg-hr-panel hover:border-hr-ink-strong",
        disabled && seat.available && !mine && "cursor-default hover:border-hr-line-strong",
      )}
    >
      {mine ?? ""}
    </button>
  );
}

export function SeatsResult({ block }: { block: SeatsBlock }) {
  const { send } = useChat();
  const editable = useEditable("seats");
  const [tab, setTab] = useState(0);
  const [active, setActive] = useState(block.pax[0]?.id);
  const [picks, setPicks] = useState<Picks>({});
  const current = block.maps[tab];
  const segId = current.segment.segment_id!;

  const rows = useMemo(() => {
    const byRow = new Map<number, Map<string, Seat>>();
    for (const s of current.map.seats) {
      if (!byRow.has(s.row)) byRow.set(s.row, new Map());
      byRow.get(s.row)!.set(s.column, s);
    }
    return [...byRow.entries()].sort((a, b) => a[0] - b[0]);
  }, [current]);
  const cols = useMemo(() => layout(current.map.seats), [current]);

  const total = Object.values(picks).reduce((a, seg) => a + Object.values(seg).reduce((b, p) => b + p.price, 0), 0);
  const count = Object.values(picks).reduce((a, seg) => a + Object.keys(seg).length, 0);
  const paxNo = (id: string) => String(block.pax.findIndex((p) => p.id === id) + 1);
  const holderAt = (row: number, column: string) => Object.entries(picks[segId] ?? {}).find(([, p]) => p.row === row && p.column === column)?.[0];

  const pick = (s: Seat) => {
    if (!active) return;
    setPicks((all) => {
      const seg = { ...(all[segId] ?? {}) };
      const holder = Object.entries(seg).find(([, p]) => p.row === s.row && p.column === s.column)?.[0];
      if (holder) delete seg[holder];
      if (holder !== active) seg[active] = { row: s.row, column: s.column, price: s.price?.amount ?? 0 };
      // The next traveller without a seat on this flight is up.
      const next = block.pax.find((p) => !seg[p.id] && p.id !== active);
      if (next && holder !== active) setActive(next.id);
      return { ...all, [segId]: seg };
    });
  };

  const submit = () => {
    const seats = Object.entries(picks).flatMap(([segment_id, seg]) => Object.entries(seg).map(([passenger_id, p]) => ({ segment_id, row: p.row, column: p.column, passenger_id })));
    const list = seats.map((s) => `${s.row}${s.column}`).join(", ");
    send(es() ? `Asientos: ${list}${total ? ` (${money(total, block.currency)})` : ""}` : `Seats: ${list}${total ? ` (${money(total, block.currency)})` : ""}`, { kind: "seats", seats });
  };
  const skip = () => send(es() ? "Sin asientos, gracias" : "No seats, thanks", { kind: "seats", skip: true });

  return (
    <StepCard step="seats" aside={count > 0 && <span className="font-mono text-[10px] tabular-nums text-hr-ink-3">{money(total, block.currency)}</span>}>
      {block.maps.length > 1 && (
        <div className="flex overflow-x-auto border-b border-hr-line">
          {block.maps.map((m, i) => (
            <button
              key={m.segment.segment_id}
              type="button"
              onClick={() => setTab(i)}
              className={cn(
                "shrink-0 cursor-pointer border-r border-hr-line px-4 py-2.5 text-left transition-colors duration-300",
                i === tab ? "bg-hr-highlight shadow-[inset_0_-2px_0_var(--hr-rust)]" : "hover:bg-hr-highlight",
              )}
            >
              <span className="block font-mono text-[11px] text-hr-ink-strong">
                <Place code={m.segment.origin} nameClassName="text-hr-ink-3" /> → <Place code={m.segment.destination} nameClassName="text-hr-ink-3" />
              </span>
              <span className="block text-[11px] text-hr-ink-3">
                {m.segment.flight_number} · {clock(m.segment.departure_utc)} · {Object.keys(picks[m.segment.segment_id!] ?? {}).length}/{block.pax.length}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 px-4 py-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="min-w-0">
          <p className="mb-4 text-[12px] text-hr-ink-3">
            {airlineName(current.map.airline ?? current.segment.marketing_carrier ?? "")} {current.segment.flight_number}
            {current.map.aircraft ? ` · aircraft ${current.map.aircraft}` : ""} · front of the plane on top
          </p>
          <div className="max-h-[420px] overflow-auto pr-1">
            <table className="mx-auto border-separate border-spacing-[3px]">
              <thead>
                <tr>
                  <th />
                  {cols.map((c, i) => (
                    <th key={c ?? `gap${i}`} className={cn("font-mono text-[10px] font-normal text-hr-ink-3", !c && "w-4")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([row, seats]) => {
                  const exit = [...seats.values()].some((s) => s.features?.includes("exit_row"));
                  return (
                    <tr key={row}>
                      <td className={cn("pr-1 text-right font-mono text-[10px] tabular-nums", exit ? "text-hr-rust" : "text-hr-ink-4")} title={exit ? "Exit row" : undefined}>
                        {row}
                      </td>
                      {cols.map((c, i) =>
                        c ? (
                          <td key={c}>
                            <SeatButton
                              seat={seats.get(c)}
                              disabled={!editable}
                              mine={holderAt(row, c) ? paxNo(holderAt(row, c)!) : undefined}
                              onPick={() => pick(seats.get(c)!)}
                            />
                          </td>
                        ) : (
                          <td key={`gap${i}`} />
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-hr-ink-3">
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 border border-hr-line-strong bg-hr-panel" /> Free
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 border border-hr-line-strong bg-hr-signal" /> Paid
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 bg-hr-rust" /> Yours
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 bg-[repeating-linear-gradient(45deg,var(--hr-line-strong)_0_2px,transparent_2px_5px)]" /> Taken
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-t border-hr-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <p className="hr-eyebrow text-[10px]">Who sits where</p>
          <div className="flex flex-col gap-1.5">
            {block.pax.map((p, i) => {
              const seat = picks[segId]?.[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!editable}
                  onClick={() => setActive(p.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 border px-2.5 py-2 text-left text-[12px] transition-colors duration-300 disabled:cursor-default",
                    active === p.id && editable ? "border-hr-ink-strong bg-hr-highlight" : "border-hr-line",
                  )}
                >
                  <span className="grid size-5 place-items-center bg-hr-rust font-mono text-[10px] text-white">{i + 1}</span>
                  <span className="flex-1 text-hr-ink-strong">{p.label}</span>
                  <span className="font-mono text-[11px] text-hr-ink-3">{seat ? `${seat.row}${seat.column}` : "—"}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto space-y-2 pt-3">
            <p className="flex items-baseline justify-between text-[12px] text-hr-ink-3">
              Seats <span className="text-[18px] tabular-nums text-hr-ink-strong">{money(total, block.currency)}</span>
            </p>
            <Button className="w-full cursor-pointer" disabled={!editable || count === 0} onClick={submit}>
              Confirm seats <ArrowBox />
            </Button>
            <Button variant="outline" className="w-full cursor-pointer" disabled={!editable} onClick={skip}>
              Skip seats
            </Button>
          </div>
        </div>
      </div>
    </StepCard>
  );
}
