"use client";

import { cn } from "@/lib/utils";
import { useChat } from "./chat-context";

/**
 * An airport or city code with its name beside it — "MAD Madrid" — wherever a code is shown. The code never breaks;
 * a name too long for its room ends in an ellipsis (the full name is in the tooltip) instead of pushing what is next.
 */
export function Place({ code, className, nameClassName }: { code: string; className?: string; nameClassName?: string }) {
  const { places } = useChat();
  const name = places[code];
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-baseline whitespace-nowrap align-baseline", className)} title={name ? `${name} (${code})` : undefined}>
      <span className="shrink-0 font-mono tracking-[0.04em]">{code}</span>
      {name && <span className={cn("ml-1 min-w-0 truncate font-sans tracking-normal", nameClassName)}>{name}</span>}
    </span>
  );
}
