"use client";

import { useEffect, useRef, useState } from "react";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArrowBox, Button } from "../ui/button";

/** The message box: Enter sends, Shift+Enter breaks the line; while the agent writes, Stop replaces Send. */
export function Composer({ onSend, onStop, busy, autoFocus, placeholder }: { onSend: (t: string) => void; onStop: () => void; busy: boolean; autoFocus?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);
  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-0 border border-hr-border-cta bg-hr-panel transition-[border-color,box-shadow] duration-300 focus-within:border-hr-ink-strong focus-within:shadow-[inset_2px_0_0_var(--hr-rust)]"
    >
      <label htmlFor="na-message" className="sr-only">
        Message
      </label>
      <textarea
        id="na-message"
        ref={ref}
        rows={1}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder ?? "Where do you want to go?"}
        className="field-sizing-content max-h-40 min-h-12 flex-1 resize-none bg-transparent px-4 py-3.5 text-[14px] leading-[1.5] text-hr-ink-strong outline-none placeholder:text-hr-ink-4"
      />
      <div className="p-1.5">
        {busy ? (
          <Button type="button" variant="outline" onClick={onStop} className="cursor-pointer">
            <Square className="size-3" /> Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!text.trim()} className={cn("cursor-pointer")}>
            Send <ArrowBox />
          </Button>
        )}
      </div>
    </form>
  );
}
