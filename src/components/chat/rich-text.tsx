"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { useChat } from "./chat-context";

/** An offer ref in the agent's text: a chip that jumps to its card. */
function RefChip({ id }: { id: string }) {
  const { highlight } = useChat();
  return (
    <button
      type="button"
      onClick={() => highlight(id)}
      className="mx-0.5 inline-flex cursor-pointer items-center gap-1 border border-hr-line-strong bg-hr-panel px-1 py-px align-[1px] font-mono text-[11px] leading-none text-hr-ink-strong transition-colors duration-300 hover:border-hr-rust hover:text-hr-rust"
    >
      {id}
    </button>
  );
}

/** **bold** and offer refs within one line. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\bo\d{1,4}\b)/g).map((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk))
      return (
        <strong key={i} className="font-medium text-hr-ink-strong">
          {inline(chunk.slice(2, -2))}
        </strong>
      );
    if (/^o\d{1,4}$/.test(chunk)) return <RefChip key={i} id={chunk} />;
    return <Fragment key={i}>{chunk}</Fragment>;
  });
}

/** The agent's prose: paragraphs, "- " bullets, bold and offer refs — the little markdown the prompt allows. */
export function RichText({ text, writing, className }: { text: string; writing?: boolean; className?: string }) {
  const paragraphs = text.trim().split(/\n{2,}/);
  return (
    <div className={cn("space-y-2.5 text-[14px] leading-[1.6] text-hr-ink-1", className)}>
      {paragraphs.map((p, i) => {
        const last = i === paragraphs.length - 1;
        const rows = p.split("\n");
        if (rows.every((r) => /^\s*[-*•]\s+/.test(r)))
          return (
            <ul key={i} className={cn("space-y-1.5", writing && last && "na-caret")}>
              {rows.map((r, j) => (
                <li key={j} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[10px] size-[5px] shrink-0 bg-hr-rust" />
                  <span>{inline(r.replace(/^\s*[-*•]\s+/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} className={cn("text-pretty whitespace-pre-line", writing && last && "na-caret")}>
            {inline(p)}
          </p>
        );
      })}
    </div>
  );
}
