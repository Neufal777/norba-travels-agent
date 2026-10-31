import { cn } from "@/lib/utils";

/** Solid square marker — the visual atom of the whole UI. */
export function Sq({ className, size = 6 }: { className?: string; size?: number }) {
  return <span aria-hidden="true" className={cn("inline-block shrink-0 bg-hr-rust", className)} style={{ width: size, height: size }} />;
}

/** Three squares pulsing in sequence: "work in progress". */
export function Pulse({ className, dotClassName }: { className?: string; dotClassName?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex h-3 w-4 shrink-0 items-center justify-between", className)}>
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className={cn("block size-[3px] bg-hr-ink-strong motion-safe:animate-pulse", dotClassName)} style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

export function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={cn("size-3.5", className)} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 6.2 2 2 4-4.4" />
    </svg>
  );
}
