"use client";

import { useEffect, useId, useState } from "react";
import { STEP_LABELS } from "@/lib/steps";
import type { StepId, StepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useChat } from "./chat-context";
import { StepIcon, Toggle } from "./trip-panel";

const STATUS_LABEL = { pending: "Not yet", running: "Working", waiting: "Waiting for you", done: "Done", failed: "Failed", skipped: "Skipped" } as const;

/**
 * Open while `defaultOpen` says so, folding by itself the moment it turns false (a step completed, a newer result
 * arrived); the traveller can still open or fold it by hand until the default changes again.
 */
export function useAutoCollapse(defaultOpen: boolean) {
  const [override, setOverride] = useState<boolean | undefined>(undefined);
  useEffect(() => setOverride(undefined), [defaultOpen]);
  const open = override ?? defaultOpen;
  return [open, () => setOverride(!open)] as const;
}

/** The body of a section that folds: height and opacity ease together, as in the side panel. */
export function Fold({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  );
}

/** A step's section is open while the step is in play; done, skipped or undone by a newer search, it folds. */
export const stepInPlay = (status: string) => status === "waiting" || status === "running" || status === "failed";

/**
 * A settled step, folded: one quiet line with no box, its summary beside the title. It opens again on a click.
 * `row` styles a folded card's header this way; `ReceiptRow` is the same line for blocks that fold on their own.
 */
export const receiptClass = "flex h-7 w-full cursor-pointer items-center gap-2.5 px-0 text-left text-hr-ink-3 outline-none transition-colors duration-300 hover:text-hr-ink-strong focus-visible:outline-2 focus-visible:outline-hr-rust";

export function ReceiptRow({ status, title, summary, onOpen, step }: { status: StepStatus; title: string; summary?: string; onOpen: () => void; step?: string }) {
  return (
    <button type="button" data-step={step} aria-expanded={false} onClick={onOpen} className={cn("na-in group border border-transparent", receiptClass)}>
      <StepIcon status={status} />
      <span className="shrink-0 text-[12.5px] text-hr-ink-2 group-hover:text-hr-ink-strong">{title}</span>
      {summary && <span className="min-w-0 truncate text-[12px]">{summary}</span>}
      <span className="ml-auto grid size-5 shrink-0 place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <Toggle open={false} />
      </span>
    </button>
  );
}

/**
 * A booking step's card in the chat, live with the step's status. While the step is in play it is a framed card;
 * once settled it folds to a single quiet line with the step's summary, which opens it again on a click.
 */
export function StepCard({ step, children, className, aside, keepOpen }: { step: StepId; children: React.ReactNode; className?: string; aside?: React.ReactNode; keepOpen?: boolean }) {
  const { trip } = useChat();
  const s = trip.steps[step];
  const [open, toggle] = useAutoCollapse(Boolean(keepOpen) || stepInPlay(s.status));
  const row = !open && !stepInPlay(s.status);
  return (
    <section
      data-step={step}
      className={cn(
        "na-in border transition-[border-color,background-color,box-shadow] duration-500",
        row ? "border-transparent bg-transparent" : "bg-hr-panel",
        !row && (s.status === "waiting" ? "border-hr-ink-strong shadow-[inset_2px_0_0_var(--hr-rust)]" : "border-hr-line-strong/70"),
        className,
      )}
    >
      <header
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
        className={cn(
          "group",
          row
            ? receiptClass
            : "flex h-9 cursor-pointer items-center gap-3 px-4 outline-none transition-colors duration-300 hover:bg-hr-highlight focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hr-rust md:px-5",
          open && "border-b border-hr-line",
        )}
      >
        <StepIcon status={s.status} />
        <span className={cn("shrink-0", row ? "text-[12.5px] text-hr-ink-2 group-hover:text-hr-ink-strong" : "text-[12.5px] text-hr-ink-strong")}>{STEP_LABELS[step].title}</span>
        {!open && s.summary && <span className="na-in min-w-0 truncate text-[12px] text-hr-ink-3">{s.summary}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {open && aside}
          {!row && <span className={cn("font-mono text-[10px] uppercase tracking-[0.04em]", s.status === "waiting" ? "text-hr-ink-strong" : s.status === "failed" ? "text-hr-alert" : "text-hr-ink-3")}>{STATUS_LABEL[s.status]}</span>}
          <span className={cn("grid size-5 place-items-center text-hr-ink-3", row && "opacity-0 transition-opacity duration-300 group-hover:opacity-100")}>
            <Toggle open={open} />
          </span>
        </span>
      </header>
      <Fold open={open}>{children}</Fold>
    </section>
  );
}

/** True while the traveller can still answer a step's form. */
export function useEditable(step: StepId) {
  const { trip, busy } = useChat();
  const s = trip.steps[step].status;
  return !busy && trip.steps.booking.status !== "done" && (s === "waiting" || s === "failed");
}

export const inputClass =
  "h-9 w-full min-w-0 border border-hr-border-cta bg-hr-panel px-3 text-[13px] text-hr-ink-strong outline-none transition-[border-color,box-shadow] duration-300 placeholder:text-hr-ink-4 focus-visible:border-hr-ink-strong focus-visible:shadow-[inset_2px_0_0_var(--hr-rust)] disabled:opacity-50 aria-invalid:border-hr-alert";

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={id} className="hr-eyebrow block text-[10px]">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[11px] text-hr-ink-4">{hint}</p>}
    </div>
  );
}

/** Two or three mutually exclusive options, as the sort toggle draws them. */
export function Segmented<T extends string>({ value, options, onChange, label, disabled }: { value?: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex h-9 border border-hr-border-cta" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 cursor-pointer px-3 font-mono text-[10px] uppercase tracking-[0.04em] transition-colors duration-300 disabled:cursor-default",
            value === o.value ? "bg-hr-ink-strong text-hr-surface" : "text-hr-ink-3 hover:text-hr-ink-strong",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
