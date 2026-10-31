"use client";

import type { Block, ChatMessage, TripView } from "@/lib/types";
import { FileText } from "lucide-react";
import { NorbaLogo } from "../brand";
import { Pulse, Sq } from "../status";
import { BookingResult } from "./booking-block";
import { CalendarResult } from "./calendar-block";
import { ExtrasResult } from "./extras-block";
import { OffersResult } from "./offers-block";
import { PaymentResult } from "./payment-block";
import { PricedResult } from "./priced-block";
import { Replies } from "./replies-block";
import { ReviewResult } from "./review-block";
import { SeatsResult } from "./seats-block";
import { TravellersResult } from "./travellers-block";
import { RebookResult } from "./rebook-block";
import { RichText } from "./rich-text";
import { VisionResult } from "./vision-block";
import { ToolStepRow } from "./tool-step";

function BlockView({ block, live }: { block: Block; live: boolean }) {
  switch (block.kind) {
    case "offers":
      return <OffersResult block={block} />;
    case "calendar":
      return <CalendarResult block={block} />;
    case "priced":
      return <PricedResult block={block} />;
    case "replies":
      return <Replies block={block} live={live} />;
    case "seats":
      return <SeatsResult block={block} />;
    case "extras":
      return <ExtrasResult block={block} />;
    case "travellers":
      return <TravellersResult block={block} />;
    case "review":
      return <ReviewResult block={block} />;
    case "payment":
      return <PaymentResult block={block} />;
    case "booking":
      return <BookingResult block={block} />;
    case "vision":
      return <VisionResult block={block} />;
    case "rebook":
      return <RebookResult block={block} />;
  }
}

export function UserMessage({ m }: { m: ChatMessage }) {
  const text = m.parts[0]?.kind === "text" ? m.parts[0].text : "";
  return (
    <div className="na-in flex flex-col items-end gap-1.5">
      {m.attachments?.length ? (
        <ul className="flex flex-wrap justify-end gap-1.5">
          {m.attachments.map((a) => (
            <li key={a.id} className="border border-hr-line-strong bg-hr-signal">
              {a.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- the traveller's own file, held in the browser
                <img src={a.data} alt={a.name} className="block h-28 w-auto max-w-56 object-cover" />
              ) : (
                <span className="flex h-12 items-center gap-2 px-3 text-[12.5px] text-hr-ink-2">
                  <FileText className="size-4" /> {a.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {text && <p className="max-w-[min(36rem,85%)] whitespace-pre-wrap bg-hr-signal px-3.5 py-2 text-[14px] leading-[1.5] text-hr-ink-strong">{text}</p>}
    </div>
  );
}

/** Which trip step a booking block answers. */
const BLOCK_STEP = { priced: "price", seats: "seats", extras: "extras", travellers: "travellers", review: "review", payment: "payment" } as const;

/**
 * A booking turn whose steps are all settled says nothing new: its words were instructions for a form already
 * answered. It shrinks to its folded steps, one quiet line each.
 */
export function isSettledTurn(m: ChatMessage, trip: TripView) {
  if (m.failed) return false;
  const blocks = m.parts.flatMap((p) => (p.kind === "block" ? [p.block] : []));
  const steps = blocks.flatMap((b) => (b.kind in BLOCK_STEP ? [BLOCK_STEP[b.kind as keyof typeof BLOCK_STEP]] : []));
  if (!steps.length || blocks.some((b) => b.kind === "offers" || b.kind === "calendar" || b.kind === "booking")) return false;
  return steps.every((id) => trip.steps[id].status === "done" || trip.steps[id].status === "skipped");
}

/** A settled booking turn: only its folded steps, under the agent's column, no mark of its own. */
export function SettledTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-3.5">
      <div />
      <div className="min-w-0">
        {m.parts.map((p) => (p.kind === "block" && p.block.kind in BLOCK_STEP ? <BlockView key={p.block.id} block={p.block} live={false} /> : null))}
      </div>
    </div>
  );
}

/** The agent's turn, in the order things happened: words, what it is doing right now, and what it found. */
export function AgentMessage({ m, writing, latest }: { m: ChatMessage; writing: boolean; latest: boolean }) {
  const lastText = m.parts.findLastIndex((p) => p.kind === "text");
  // Between steps, while the model reads a result and before its next words, the turn says it is thinking.
  const thinking = writing && m.parts.at(-1)?.kind !== "text";
  return (
    <div className="na-in grid grid-cols-[18px_minmax(0,1fr)] gap-x-3.5">
      <div className="pt-0.5">
        <NorbaLogo className="size-[18px]" title="Norba Travels Agent" />
      </div>
      <div className="min-w-0 space-y-3">
        {m.parts.map((p, i) => {
          if (p.kind === "text") return <RichText key={i} text={p.text} writing={writing && i === lastText && i === m.parts.length - 1} />;
          // A step shows while it runs or if it failed; once done, the side panel and the card it made tell it.
          if (p.kind === "tool") return p.step.name === "suggest_replies" || p.step.status === "done" ? null : <ToolStepRow key={p.step.id} step={p.step} />;
          return <BlockView key={p.block.id} block={p.block} live={latest && !writing} />;
        })}
        {thinking && !m.parts.some((p) => p.kind === "tool" && p.step.status === "running") && (
          <p className="flex h-6 items-center gap-3 font-mono text-[11px] uppercase tracking-[0.04em] text-hr-ink-3">
            <Pulse /> Thinking
          </p>
        )}
        {m.failed && (
          <p className="flex items-start gap-3 text-[14px] text-hr-alert">
            <Sq className="mt-[7px] bg-hr-alert" />
            {m.failed}
          </p>
        )}
      </div>
    </div>
  );
}
