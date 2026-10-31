"use client";

import type { RepliesBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useChat } from "./chat-context";

/** Tappable answers the agent suggested; only the latest message's are live. */
export function Replies({ block, live }: { block: RepliesBlock; live: boolean }) {
  const { send, busy } = useChat();
  if (!live) return null;
  return (
    <div className="na-in flex flex-wrap gap-2 pt-1">
      {block.options.map((o, i) => (
        <button
          key={o}
          type="button"
          disabled={busy}
          onClick={() => send(o)}
          style={{ animationDelay: `${i * 60}ms` }}
          className={cn(
            "hr-chip-draw na-in cursor-pointer border border-hr-line-strong bg-hr-panel px-3 py-2 text-[13px] leading-none text-hr-ink-strong transition-colors duration-300 hover:text-hr-ink-strong disabled:cursor-default disabled:opacity-45",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
