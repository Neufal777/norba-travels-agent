import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/btn relative isolate inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-mono text-[11px] uppercase leading-none tracking-[0.04em] transition-[opacity,transform,background-color,border-color,color] duration-[350ms] ease-hr outline-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hr-rust disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        // Solid CTA: a stone fill rises from the bottom on hover.
        default:
          "bg-hr-cta-solid-bg text-hr-cta-solid-fg before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:origin-bottom before:scale-y-0 before:bg-hr-cta-fill before:transition-transform before:duration-[350ms] before:ease-hr hover:before:scale-y-100 motion-reduce:before:transition-none",
        signal: "bg-hr-signal text-hr-ink-strong hover:bg-hr-line",
        destructive:
          "bg-hr-alert text-white before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:origin-bottom before:scale-y-0 before:bg-hr-obsidian before:transition-transform before:duration-[350ms] before:ease-hr hover:before:scale-y-100",
        outline: "border border-hr-line-strong bg-transparent text-hr-ink-strong hover:border-hr-ink-strong hover:bg-hr-highlight",
        secondary: "bg-hr-signal text-hr-ink-strong hover:bg-hr-line",
        ghost: "text-hr-ink-1 hover:bg-hr-highlight hover:text-hr-ink-strong",
        link: "font-body text-sm normal-case tracking-normal text-hr-ink-strong underline decoration-hr-line underline-offset-4 hover:decoration-hr-ink-strong",
      },
      size: {
        default: "h-10 px-5 has-[>svg]:px-4",
        xs: "h-6 gap-1 px-2 text-[10px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-[10.5px] has-[>svg]:px-2.5",
        lg: "h-11 gap-3 px-6 has-[>svg]:px-5",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

const ARROW = "M1 5h8M5.5 1.5 9 5 5.5 8.5"

/**
 * The boxed arrow that ends a CTA: on hover the arrow slides out to the right
 * while a second one slides in from the left. `diagonal` tilts it to ↗.
 */
function ArrowBox({ className, diagonal = false, large = false }: { className?: string; diagonal?: boolean; large?: boolean }) {
  const box = large ? "size-[27px]" : "size-[18px]"
  const icon = large ? "-ml-[5.5px] -mt-[5.5px] size-[11px]" : "-ml-[4.5px] -mt-[4.5px] size-[9px]"
  const shift = large ? "group-hover/btn:translate-x-9" : "group-hover/btn:translate-x-6"
  const enter = large ? "-translate-x-9" : "-translate-x-6"
  return (
    <span aria-hidden="true" className={cn("relative shrink-0 overflow-hidden border border-current/60", box, className)}>
      <span className={cn("absolute inset-0", diagonal && "-rotate-45")}>
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className={cn("absolute left-1/2 top-1/2 transition-transform duration-[350ms] ease-hr motion-reduce:transition-none", icon, shift)}>
          <path d={ARROW} />
        </svg>
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className={cn("absolute left-1/2 top-1/2 transition-transform duration-[350ms] ease-hr group-hover/btn:translate-x-0 motion-reduce:transition-none", icon, enter)}>
          <path d={ARROW} />
        </svg>
      </span>
    </span>
  )
}

export { ArrowBox, Button, buttonVariants }
