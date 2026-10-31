"use client";

import { useState } from "react";
import { Armchair, Bike, Briefcase, Luggage, Sparkles, Utensils, Zap } from "lucide-react";
import { money } from "@/lib/format";
import type { ExtrasBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowBox, Button } from "../ui/button";
import { es, useChat } from "./chat-context";
import { StepCard, useEditable } from "./step-card";

const ICON: Record<string, typeof Luggage> = {
  bag_checked: Luggage,
  bag_carry_on: Briefcase,
  priority_boarding: Zap,
  fast_track: Zap,
  meal: Utensils,
  sport_equipment: Bike,
  extra_legroom: Armchair,
};

/** Bags first, then what makes the trip easier, then the rest. */
const ORDER = ["bag_checked", "bag_carry_on", "priority_boarding", "fast_track", "extra_legroom", "meal", "lounge", "wifi", "sport_equipment", "pet", "insurance", "upgrade", "other"];

export function ExtrasResult({ block }: { block: ExtrasBlock }) {
  const { send } = useChat();
  const editable = useEditable("extras");
  // service_id → the travellers it is bought for
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const services = [...block.services].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const currency = services.find((s) => s.price)?.price?.currency ?? "EUR";
  const pax = block.pax.filter((p) => p.type !== "INF");
  const total = Object.entries(chosen).reduce((a, [id, who]) => a + (block.services.find((s) => s.service_id === id)?.price?.amount ?? 0) * who.length, 0);
  const count = Object.values(chosen).reduce((a, w) => a + w.length, 0);

  const toggle = (id: string, pid: string) =>
    setChosen((all) => {
      const who = all[id] ?? [];
      return { ...all, [id]: who.includes(pid) ? who.filter((x) => x !== pid) : [...who, pid] };
    });

  const submit = () => {
    const extras = Object.entries(chosen).flatMap(([service_id, who]) => who.map((passenger_id) => ({ service_id, passenger_id })));
    const names = Object.entries(chosen)
      .filter(([, w]) => w.length)
      .map(([id, w]) => `${block.services.find((s) => s.service_id === id)?.name}${w.length > 1 ? ` ×${w.length}` : ""}`);
    send(`${es() ? "Extras" : "Extras"}: ${names.join(", ")} (${money(total, currency)})`, { kind: "extras", extras });
  };
  const skip = () => send(es() ? "Sin extras, gracias" : "No extras, thanks", { kind: "extras", skip: true });

  return (
    <StepCard step="extras" aside={count > 0 && <span className="font-mono text-[10px] tabular-nums text-hr-ink-3">{money(total, currency)}</span>}>
      <ul className="divide-y divide-hr-line">
        {services.map((s) => {
          const Icon = ICON[s.type] ?? Sparkles;
          const who = chosen[s.service_id] ?? [];
          return (
            <li key={s.service_id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 transition-colors duration-300 md:px-5", who.length && "bg-hr-highlight")}>
              <Icon className={cn("size-4 shrink-0", who.length ? "text-hr-rust" : "text-hr-ink-3")} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-hr-ink-strong">{s.name}</p>
                {s.description && <p className="truncate text-[11.5px] text-hr-ink-3">{s.description}</p>}
              </div>
              <span className="font-mono text-[12px] tabular-nums text-hr-ink-2">{s.price ? money(s.price.amount, s.price.currency) : "Included"}</span>
              <div className="flex gap-1.5">
                {pax.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!editable}
                    aria-pressed={who.includes(p.id)}
                    title={p.label}
                    onClick={() => toggle(s.service_id, p.id)}
                    className={cn(
                      "h-7 min-w-7 cursor-pointer border px-2 font-mono text-[10px] uppercase tracking-[0.04em] transition-colors duration-300 disabled:cursor-default",
                      who.includes(p.id) ? "border-hr-rust bg-hr-rust text-white" : "border-hr-line-strong text-hr-ink-3 hover:border-hr-ink-strong hover:text-hr-ink-strong",
                    )}
                  >
                    {pax.length > 1 ? i + 1 : "Add"}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hr-line px-4 py-3 md:px-5">
        <p className="text-[12px] text-hr-ink-3">
          {pax.length > 1 ? "1, 2… are the travellers. " : ""}
          {count ? `${count} item${count > 1 ? "s" : ""} · ` : ""}
          <span className="tabular-nums text-hr-ink-strong">{money(total, currency)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="cursor-pointer" disabled={!editable} onClick={skip}>
            Skip extras
          </Button>
          <Button size="sm" className="cursor-pointer" disabled={!editable || count === 0} onClick={submit}>
            Add extras <ArrowBox />
          </Button>
        </div>
      </div>
    </StepCard>
  );
}
