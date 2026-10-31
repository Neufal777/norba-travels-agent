import type { ToolStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Pulse, Sq } from "../status";

/** One thing the agent did: a mono line that pulses while running and settles into a check or a red square. */
export function ToolStepRow({ step }: { step: ToolStep }) {
  return (
    <div className="na-in flex min-h-6 items-center gap-3 font-mono text-[11px] uppercase tracking-[0.04em]">
      <span className="inline-grid size-4 shrink-0 place-items-center">
        {step.status === "running" ? <Pulse /> : step.status === "done" ? <Check className="text-hr-success" /> : <Sq size={7} className="bg-hr-alert" />}
      </span>
      <span className={cn("text-hr-ink-strong", step.status !== "running" && "text-hr-ink-2")}>{step.label}</span>
      {step.detail && <span className={cn("normal-case tracking-normal text-hr-ink-3", step.status === "error" && "text-hr-alert")}>· {step.detail}</span>}
    </div>
  );
}
