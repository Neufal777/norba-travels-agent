"use client";

import { cn } from "@/lib/utils";
import { useChat } from "./chat-context";

/** An airport or city code with its name beside it — "MAD Madrid" — wherever a code is shown. */
export function Place({ code, className, nameClassName }: { code: string; className?: string; nameClassName?: string }) {
  const { places } = useChat();
  const name = places[code];
  return (
    <span className={cn("whitespace-nowrap", className)} title={name ? `${name} (${code})` : undefined}>
      <span className="font-mono tracking-[0.04em]">{code}</span>
      {name && <span className={cn("ml-1 font-sans tracking-normal", nameClassName)}>{name}</span>}
    </span>
  );
}
