"use client";

import { useEffect, useState } from "react";
import { formatDistanceStrict } from "date-fns";
import { PHASES, STEP_LABELS, isFinished } from "@/lib/steps";
import { STEPS, type StepId, type StepStatus, type TripView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Pulse, Sq } from "../status";

export function StepIcon({ status, className }: { status: StepStatus; className?: string }) {
  let mark: React.ReactNode;
  switch (status) {
    case "done":
      mark = <Check className="text-hr-success" />;
      break;
    case "running":
      mark = <Pulse />;
      break;
    case "waiting":
      mark = <Sq size={7} className="motion-safe:animate-pulse" />;
      break;
    case "failed":
      mark = <Sq size={7} className="bg-hr-alert" />;
      break;
    case "skipped":
      mark = <span aria-hidden="true" className="size-[7px] border border-hr-stone" />;
      break;
    default:
      mark = <Sq className="bg-hr-stone/70" />;
  }
  return <span className={cn("inline-grid size-4 shrink-0 place-items-center", className)}>{mark}</span>;
}

/** Plus that turns into a minus — the accordion toggle. */
export function Toggle({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="relative size-2.5 shrink-0 text-current">
      <span className="absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-current" />
      <span
        className={cn(
          "absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-current transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "rotate-90 scale-y-0" : "rotate-0 scale-y-100",
        )}
      />
    </span>
  );
}

/** Scrolls the chat to the newest card a step produced. */
function jumpTo(id: StepId) {
  const all = document.querySelectorAll<HTMLElement>(`[data-step~="${id}"]`);
  const el = all[all.length - 1];
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("na-flash");
  void el.offsetWidth;
  el.classList.add("na-flash");
}

/** Ticks once a second while a step is running, so its clock moves. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function Timeline({ trip, expandAll }: { trip: TripView; expandAll: boolean }) {
  const [overrides, setOverrides] = useState<Partial<Record<StepId, boolean>>>({});
  useEffect(() => setOverrides({}), [expandAll]);
  const now = useNow(STEPS.some((id) => trip.steps[id].status === "running"));
  return (
    <div>
      {PHASES.map((phase) => (
        <div key={phase.title}>
          <p className="hr-eyebrow px-3 pb-1 pt-3 text-[10px]">{phase.title}</p>
          <ol className="relative">
            {phase.steps.map((id) => {
              const idx = STEPS.indexOf(id);
              const s = trip.steps[id];
              const current = trip.current === id;
              const finished = isFinished(s);
              const open = overrides[id] ?? (!finished || expandAll);
              // Instant steps show no clock; a step waiting on the traveller is not the agent's time.
              const ms = s.startedAt && s.status !== "waiting" ? (s.endedAt ?? now) - s.startedAt : 0;
              const took = ms >= 1000 ? formatDistanceStrict(s.startedAt! + ms, s.startedAt!) : null;
              const detail = s.error ?? s.summary ?? STEP_LABELS[id].hint;
              const last = id === phase.steps.at(-1);
              return (
                <li key={id} className="group relative">
                  {!last && (
                    <span
                      aria-hidden="true"
                      className={cn("absolute left-[43px] border-l border-dashed border-hr-line-strong", open ? "top-[30px] h-[calc(100%-18px)]" : "top-[26px] h-[calc(100%-12px)]")}
                    />
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={finished ? open : undefined}
                    aria-current={current ? "step" : undefined}
                    onClick={() => {
                      jumpTo(id);
                      if (finished && !open) setOverrides((o) => ({ ...o, [id]: true }));
                    }}
                    onKeyDown={(e) => e.key === "Enter" && jumpTo(id)}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-2.5 px-3 text-left transition-[background-color,padding] duration-500 ease-hr-soft outline-none hover:bg-hr-highlight focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hr-rust",
                      open ? "py-2.5" : "py-[7px]",
                      current && "bg-hr-highlight shadow-[inset_2px_0_0_var(--hr-rust)]",
                    )}
                  >
                    <span className="w-[14px] pt-[3px] font-mono text-[10px] leading-none tabular-nums text-hr-ink-3">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="relative z-10 grid size-4 place-items-center bg-hr-panel">
                      <StepIcon status={s.status} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "text-[13px] leading-[1.15] tracking-[-0.002em] text-hr-ink-strong",
                            s.status === "pending" && "text-hr-ink-3",
                            s.status === "skipped" && !open && "text-hr-ink-3",
                            current && "font-medium",
                          )}
                        >
                          {STEP_LABELS[id].title}
                        </span>
                        {took && <span className="font-mono text-[10px] text-hr-ink-4">{took}</span>}
                        {s.status === "skipped" && !open && <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-4">skipped</span>}
                      </div>
                      <div className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                        <div className="overflow-hidden" inert={!open}>
                          <p className={cn("pt-1 text-[11.5px] leading-snug text-hr-ink-3", s.status === "failed" && "text-hr-alert", s.status === "waiting" && "text-hr-ink-strong")}>{detail}</p>
                        </div>
                      </div>
                    </div>
                    {finished && (
                      <button
                        type="button"
                        aria-label={open ? `Collapse ${STEP_LABELS[id].title}` : `Expand ${STEP_LABELS[id].title}`}
                        aria-expanded={open}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverrides((o) => ({ ...o, [id]: !open }));
                        }}
                        className="-my-1 grid size-7 shrink-0 cursor-pointer place-items-center text-hr-ink-3 transition-colors hover:text-hr-ink-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hr-rust"
                      >
                        <Toggle open={open} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** The live line on top of the panel: what the agent or the airline is doing, or what it waits on. */
function NowLine({ trip, busy }: { trip: TripView; busy: boolean }) {
  const s = trip.current ? trip.steps[trip.current] : undefined;
  const waiting = s?.status === "waiting";
  const failed = s?.status === "failed";
  return (
    <div className={cn("flex items-start gap-3 border-b border-hr-line px-4 py-3", waiting && "bg-hr-rust/8", failed && "bg-hr-alert/8")}>
      <span className="mt-[3px]">{busy && !waiting ? <Pulse /> : <Sq className={cn(waiting ? "motion-safe:animate-pulse" : failed ? "bg-hr-alert" : trip.pnr ? "bg-hr-success" : "bg-hr-stone")} />}</span>
      <div className="min-w-0">
        <p className="hr-eyebrow text-[10px]">{waiting ? "Waiting for you" : busy ? "Now" : failed ? "Needs attention" : "Status"}</p>
        <p key={trip.now} className="na-in mt-1 text-[12.5px] leading-snug text-hr-ink-strong">
          {trip.now}
        </p>
      </div>
    </div>
  );
}

export function TripPanel({ trip, busy }: { trip: TripView; busy: boolean }) {
  const [expandAll, setExpandAll] = useState(false);
  const done = STEPS.filter((id) => isFinished(trip.steps[id])).length;
  return (
    <div className="border border-hr-line-strong/70 bg-hr-panel">
      <div className="flex h-9 items-center justify-between gap-3 border-b border-hr-line px-4 text-[11px]">
        <span className="text-hr-ink-3">
          Trip<span className="px-1">/</span>
          <span className="text-hr-ink-strong">{trip.pnr ?? (trip.current ? STEP_LABELS[trip.current].title : "Complete")}</span>
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3">
          {done > 0 && (
            <button type="button" onClick={() => setExpandAll((v) => !v)} className="group cursor-pointer uppercase text-hr-ink-3 transition-colors hover:text-hr-ink-strong">
              <span className="hr-underline">{expandAll ? "Collapse all" : "Expand all"}</span>
            </button>
          )}
          <span className="tabular-nums">
            {done}/{STEPS.length}
          </span>
        </span>
      </div>
      <NowLine trip={trip} busy={busy} />
      <div className="h-[3px] bg-hr-line/60">
        <div className="h-full bg-hr-ink-strong transition-[width] duration-700 ease-hr" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>
      <div className="pb-2">
        <Timeline trip={trip} expandAll={expandAll} />
      </div>
    </div>
  );
}

/** Below the large breakpoint: one line with the current step that opens the whole panel. */
export function TripBar({ trip, busy }: { trip: TripView; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const done = STEPS.filter((id) => isFinished(trip.steps[id])).length;
  const cur = trip.current;
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-3 border border-hr-line-strong/70 bg-hr-panel px-4 py-2.5 text-left"
      >
        {cur ? <StepIcon status={trip.steps[cur].status} /> : <Check className="text-hr-success" />}
        <span className="font-mono text-[10px] tabular-nums text-hr-ink-3">{cur ? String(STEPS.indexOf(cur) + 1).padStart(2, "0") : "12"}/12</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-hr-ink-strong">{busy || trip.steps[cur ?? "tickets"].status === "waiting" ? trip.now : cur ? STEP_LABELS[cur].title : "Booked"}</span>
        <span className="font-mono text-[10px] tabular-nums text-hr-ink-3">{done}/12</span>
        <Toggle open={open} />
      </button>
      {open && (
        <div className="na-in mt-2">
          <TripPanel trip={trip} busy={busy} />
        </div>
      )}
    </div>
  );
}
