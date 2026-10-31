import type { Metadata } from "next";
import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, dayPart, duration, money } from "@/lib/format";
import { NorbaWordmark } from "@/components/brand";
import { getCheckout, holdEnded } from "@/server/checkout";
import { norba } from "@/server/norba";
import { norbaEnvironment } from "@/server/config";
import { shortName } from "@/server/agent/places";
import { PayForm } from "./pay-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/** A checkout link: the flight, its exact total, and the form where the traveller books it themselves. */
export default async function Pay({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = getCheckout(token);
  if (!c) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-xl place-items-center px-5 text-center">
        <div className="space-y-3">
          <NorbaWordmark sub="Checkout" />
          <p className="text-[15px] text-hr-ink-2">This link has expired. Ask for a new one.</p>
        </div>
      </main>
    );
  }
  const codes = [...new Set(c.offer.slices.flatMap((s) => s.segments.flatMap((g) => [g.origin, g.destination])))];
  const names = new Map<string, string>();
  try {
    for (const a of await norba().airportsByCode(codes)) names.set(a.iata_code, shortName(a));
  } catch {}
  const at = (code: string) => (names.get(code) ? `${names.get(code)} (${code})` : code);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-8 md:py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <NorbaWordmark sub="Checkout" />
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">{norbaEnvironment() === "production" ? "Live booking" : "Test booking · no real charge"}</span>
      </header>

      <section className="border border-hr-line-strong/70 bg-hr-panel">
        <div className="flex items-center justify-between gap-3 border-b border-hr-line px-4 py-3">
          <p className="text-[14px] text-hr-ink-strong">{c.label ?? "Your flight"}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">{airlineName(c.offer.airline)}</p>
        </div>
        <ul className="divide-y divide-hr-line">
          {c.offer.slices.map((s, i) => (
            <li key={i} className="space-y-1 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">
                {dateLabel(dayPart(s.departure_utc))} · {duration(s.duration_minutes)} · {s.stops ? `${s.stops} stop` : "direct"} · {s.segments.map((g) => g.flight_number).join(" + ")}
              </p>
              <p className="text-[15px] tabular-nums text-hr-ink-strong">
                {clock(s.departure_utc)} {at(s.origin)} → {clock(s.arrival_utc)} {at(s.destination)}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-end justify-between gap-3 border-t border-hr-line px-4 py-3">
          <p className="text-[12px] text-hr-ink-3">
            {c.slots.length} traveller{c.slots.length > 1 ? "s" : ""} · {c.offer.fare_family?.name ?? "Fare"}
            {c.offer.price_guaranteed_until && !holdEnded(c) && ` · price held until ${clock(c.offer.price_guaranteed_until)}`}
          </p>
          <p className="text-[24px] leading-none tracking-[-0.03em] tabular-nums text-hr-ink-strong">{money(c.total, c.currency, { cents: true })}</p>
        </div>
      </section>

      <PayForm
        token={c.token}
        slots={c.slots}
        total={money(c.total, c.currency, { cents: true })}
        expired={holdEnded(c)}
        test={norbaEnvironment() !== "production"}
        paid={c.order ? { pnr: c.order.pnr ?? c.order.order_id, status: c.order.status } : undefined}
      />
      <p className="mt-8 text-center text-[11px] text-hr-ink-4">Powered by Norba · your card goes to the airline for this booking only and is never stored</p>
    </main>
  );
}
