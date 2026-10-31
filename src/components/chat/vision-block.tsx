"use client";

import { FileText, ScanText } from "lucide-react";
import type { VisionBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pulse, Sq } from "../status";
import { useChat } from "./chat-context";

const KIND: Record<string, string> = {
  trip_request: "Trip",
  departure_board: "Departure board",
  boarding_pass: "Boarding pass",
  booking_confirmation: "Booking",
  other: "File",
};

/** A box on the 0–1000 grid Muse Spark answers in, as percentages over the image. */
const place = (b: number[]) => ({ left: `${b[0] / 10}%`, top: `${b[1] / 10}%`, width: `${(b[2] - b[0]) / 10}%`, height: `${(b[3] - b[1]) / 10}%` });

/**
 * What Muse Spark read in a file, drawn over it: a scan line while it reads, then a box around every fact it found —
 * and on a departure board, the traveller's own row in red.
 */
export function VisionResult({ block }: { block: VisionBlock }) {
  const { attachment } = useChat();
  const file = attachment(block.attachmentId);
  const p = block.perception;
  const reading = !p && !block.error;
  const image = file?.mime.startsWith("image/") ? file.data : undefined;
  const rows = p?.kind === "departure_board" ? p.board.rows : [];
  const boxes = p ? (p.kind === "departure_board" ? [] : p.facts.filter((f) => f.box.length === 4)) : [];

  return (
    <section className="na-in grid gap-4 border border-hr-line-strong/70 bg-hr-panel p-3 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:p-4" aria-label={`Reading of ${block.name}`}>
      <div className="relative overflow-hidden border border-hr-line bg-hr-surface-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- the traveller's own file, held in the browser
          <img src={image} alt={block.name} className="block h-auto w-full" />
        ) : (
          <div className="grid aspect-[3/4] place-items-center text-hr-ink-3">
            <FileText className="size-8" />
          </div>
        )}
        {reading && <span aria-hidden="true" className="na-scan pointer-events-none absolute inset-x-0 top-0 h-10" />}
        {boxes.map((f, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="na-box pointer-events-none absolute border border-hr-ink-strong/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{ ...place(f.box), animationDelay: `${i * 90}ms` }}
          />
        ))}
        {rows.map((r, i) =>
          r.box.length === 4 ? (
            <span
              key={i}
              aria-hidden="true"
              className={cn("na-box pointer-events-none absolute border", block.match?.rowIndex === i ? "border-2 border-hr-rust bg-hr-rust/15" : "border-white/25")}
              style={{ ...place(r.box), animationDelay: `${i * 50}ms` }}
            />
          ) : null,
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">
          {reading ? <Pulse /> : <ScanText className="size-3.5" />}
          {reading ? "Reading" : block.error ? "Not read" : KIND[p!.kind]} · {block.model}
        </p>
        {reading && <p className="text-[13px] text-hr-ink-2">Muse Spark is reading {block.name}…</p>}
        {block.error && <p className="text-[13px] text-hr-alert">{block.error}</p>}
        {p && (
          <>
            <p className="text-[14px] leading-snug text-hr-ink-strong">{p.summary}</p>
            {p.kind !== "departure_board" && p.facts.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {p.facts.map((f, i) => (
                  <li key={i} className="na-in inline-flex items-center gap-1.5 border border-hr-line px-2 py-1 text-[12px]" style={{ animationDelay: `${i * 90}ms` }}>
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.04em] text-hr-ink-3">{f.label}</span>
                    <span className="text-hr-ink-strong">{f.value}</span>
                  </li>
                ))}
              </ul>
            )}
            {p.kind === "departure_board" && (
              <ul className="divide-y divide-hr-line border-y border-hr-line font-mono text-[11.5px]">
                {rows.slice(0, 8).map((r, i) => (
                  <li key={i} className={cn("grid grid-cols-[3.2rem_4.5rem_minmax(0,1fr)_auto] items-center gap-2 py-1", block.match?.rowIndex === i && "text-hr-rust")}>
                    <span className="tabular-nums">{r.time}</span>
                    <span>{r.flight}</span>
                    <span className="truncate font-sans text-[12px]">{r.destination}</span>
                    <span className="uppercase">{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
            {block.match && (
              <p className={cn("flex items-center gap-2 text-[13px]", block.match.disrupted ? "text-hr-rust" : "text-hr-ink-2")}>
                <Sq className={block.match.disrupted ? "bg-hr-rust" : "bg-hr-success"} />
                Your flight {block.match.flight}{block.match.pnr ? ` (${block.match.pnr})` : ""}: {block.match.status}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
