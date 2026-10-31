"use client";

import { HeroAirport } from "../drawing/hero-airport";
import { useChat } from "./chat-context";

const PROMPTS = [
  { label: "Weekend escape", text: "Madrid to Athens next Friday, back on Sunday, two adults" },
  { label: "Business, non-stop", text: "Non-stop business class from London to New York on 15 December" },
  { label: "En español", text: "Busca vuelos baratos de Barcelona a Santorini en dos semanas, con maleta" },
  { label: "Family trip", text: "Paris to Mykonos on 20 June for 2 adults and 2 kids, returning a week later" },
];

export function EmptyState() {
  const { send, busy } = useChat();
  return (
    <div className="space-y-6 pb-8 pt-6 md:pt-10">
      <div className="na-in grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-end">
        <div>
          <p className="hr-eyebrow mb-5 flex items-center gap-2">
            <span className="hr-sq" /> Flight agent · Meta Muse Spark × Norba
          </p>
          <h1 className="text-[34px] text-hr-ink-strong md:text-[48px]">
            Where to <span className="text-hr-ink-3">next?</span>
          </h1>
        </div>
        <p className="max-w-[44ch] text-pretty text-[14px] leading-[1.6] text-hr-ink-2">
          Say it the way you would to a friend. The agent asks the airlines directly, then takes you from the first sentence to your e-tickets — seats, bags and payment included.
        </p>
      </div>

      <div className="na-in na-paper relative h-[240px] overflow-hidden border border-hr-line-strong/70 sm:h-[clamp(240px,24vw,320px)]" style={{ animationDelay: "80ms" }}>
        <HeroAirport />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PROMPTS.map((p, i) => (
          <button
            key={p.text}
            type="button"
            disabled={busy}
            onClick={() => send(p.text)}
            style={{ animationDelay: `${200 + i * 70}ms` }}
            className="hr-chip-draw na-in group flex cursor-pointer flex-col items-start gap-2 border border-hr-line-strong/70 bg-hr-panel px-3.5 py-3 text-left disabled:cursor-default"
          >
            <span className="hr-eyebrow text-[10px]">{p.label}</span>
            <span className="text-[12.5px] leading-[1.45] text-hr-ink-1 transition-colors duration-300 group-hover:text-hr-ink-strong">{p.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
