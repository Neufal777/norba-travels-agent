"use client";

import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, dayPart, money } from "@/lib/format";
import type { ReviewBlock } from "@/lib/types";
import { useChat } from "./chat-context";
import { StepCard } from "./step-card";
import { Place } from "./place";

/** The receipt before paying: flights, travellers and every line of the total, as it will be charged. */
export function ReviewResult({ block }: { block: ReviewBlock }) {
  const { quote, offer } = block;
  const { trip } = useChat();
  // The receipt stays open beside the card form: it is what the traveller is paying for.
  return (
    <StepCard step="review" keepOpen={trip.steps.review.status === "done" && trip.steps.payment.status === "waiting"}>
      <div className="grid gap-6 px-4 py-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          {offer.slices.map((s, i) => (
            <div key={i} className="flex items-baseline gap-4">
              <span className="hr-eyebrow w-16 shrink-0 text-[10px]">{offer.slices.length === 2 ? (i ? "Return" : "Outbound") : `Flight ${i + 1}`}</span>
              <p className="text-[13px] text-hr-ink-strong">
                {dateLabel(dayPart(s.departure_utc))} · <span className="tabular-nums">{clock(s.departure_utc)}</span> <Place code={s.origin} nameClassName="text-hr-ink-3" /> → <span className="tabular-nums">{clock(s.arrival_utc)}</span> <Place code={s.destination} nameClassName="text-hr-ink-3" />
                <span className="ml-2 text-[12px] text-hr-ink-3">
                  {airlineName(offer.airline)} {s.segments.map((g) => g.flight_number).join(" + ")}
                </span>
              </p>
            </div>
          ))}
          <div className="flex items-baseline gap-4">
            <span className="hr-eyebrow w-16 shrink-0 text-[10px]">Travellers</span>
            <p className="text-[13px] text-hr-ink-strong">{block.travellers.join(", ")}</p>
          </div>
        </div>
        <dl className="space-y-2 border-t border-hr-line pt-4 text-[13px] md:border-l md:border-t-0 md:pl-5 md:pt-0">
          {block.lines.map((l) => (
            <div key={l.label} className="flex justify-between gap-4">
              <dt className="text-hr-ink-3">{l.label}</dt>
              <dd className="tabular-nums text-hr-ink-strong">{money(l.amount, quote.currency, { cents: true })}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-t border-hr-line pt-3">
            <dt className="hr-eyebrow text-[10px]">Total</dt>
            <dd className="text-[22px] leading-none tracking-[-0.03em] tabular-nums text-hr-ink-strong">{money(quote.total, quote.currency, { cents: true })}</dd>
          </div>
        </dl>
      </div>
    </StepCard>
  );
}
