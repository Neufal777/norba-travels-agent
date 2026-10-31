import { cn } from "@/lib/utils"

/** Placeholder block: warm signal tone with a light sweep (still when reduced motion is on). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-hr-signal before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--hr-panel)_70%,transparent),transparent)] before:animate-[hr-shimmer_1.6s_ease-in-out_infinite] motion-reduce:before:hidden",
        className
      )}
      {...props}
    />
  )
}

/** A few text-like lines of decreasing width. */
function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-3/4", "w-1/2"]
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", widths[i % widths.length])} />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonLines }
