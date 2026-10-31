"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { ChatMessage, FormSubmission } from "@/lib/types";
import { AppFooter } from "../app-footer";
import { AppHeader } from "../app-header";
import { ChatContext, highlightRef, type ChatActions } from "./chat-context";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { AgentMessage, SettledTurn, UserMessage, isSettledTurn } from "./message";
import { TripBar, TripPanel } from "./trip-panel";
import { useAgent } from "./use-agent";
import { cn } from "@/lib/utils";

export function AgentChat() {
  const { messages, busy, trip, places, send, stop, reset } = useAgent();
  // The chat scrolls inside its own box: the page is one screen tall, so nothing that grows or folds moves the footer.
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const empty = messages.length === 0;
  // Follow the newest content unless the traveller scrolled up to read something.
  const stick = useRef(true);

  // Only the traveller's own scrolling lets go of the bottom; the smooth scrolls this page makes never do.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let touched = 0;
    const intent = () => (touched = Date.now());
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
      if (atBottom) stick.current = true;
      else if (Date.now() - touched < 400) stick.current = false;
    };
    const keys = (e: KeyboardEvent) => ["ArrowUp", "PageUp", "Home"].includes(e.key) && intent();
    el.addEventListener("wheel", intent, { passive: true });
    el.addEventListener("touchmove", intent, { passive: true });
    el.addEventListener("keydown", keys);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", intent);
      el.removeEventListener("touchmove", intent);
      el.removeEventListener("keydown", keys);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const el = content.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const b = box.current;
      if (stick.current && b) b.scrollTo({ top: b.scrollHeight, behavior: "smooth" });
    });
    ro.observe(el);
    return () => ro.disconnect();
    // The list mounts with the first message: observe it from then on.
  }, [empty]);

  const highlight = useCallback((ref: string) => {
    if (!highlightRef(ref)) toast.message(`${ref} is no longer on screen`);
    else stick.current = false;
  }, []);

  const onSend = useCallback(
    (t: string, form?: FormSubmission) => {
      stick.current = true;
      send(t, form);
    },
    [send],
  );

  const latestOffers = useMemo(() => {
    const ids = messages.flatMap((m) => m.parts.flatMap((p) => (p.kind === "block" && p.block.kind === "offers" ? [p.block.id] : [])));
    return ids.at(-1);
  }, [messages]);
  const actions: ChatActions = useMemo(() => ({ send: onSend, busy, trip, places, highlight, latestOffers }), [onSend, busy, trip, places, highlight, latestOffers]);
  const lastAgent = messages.findLast((m) => m.role === "assistant");
  // What the chat shows: a form's answer lives in its folded card, not in a bubble; settled booking turns that follow
  // one another read as one short list.
  const turns = useMemo(() => {
    const out: ({ kind: "one"; key: string; m: ChatMessage } | { kind: "settled"; key: string; messages: ChatMessage[] })[] = [];
    for (const m of messages) {
      if (m.role === "user" && m.form) continue;
      if (m.role === "assistant" && m !== lastAgent && isSettledTurn(m, trip)) {
        const prev = out.at(-1);
        if (prev?.kind === "settled") prev.messages.push(m);
        else out.push({ kind: "settled", key: m.id, messages: [m] });
        continue;
      }
      out.push({ kind: "one", key: m.id, m });
    }
    return out;
  }, [messages, lastAgent, trip]);

  return (
    <ChatContext.Provider value={actions}>
      {/* One screen, never more: header and footer hold still, the trip panel and the chat scroll on their own. */}
      <div className="flex h-dvh flex-col overflow-hidden">
        <AppHeader onNewChat={empty ? undefined : reset} />
        {/* The trip's steps join once there is a trip to follow: the first message brings them in. */}
        <div className={cn("mx-auto grid min-h-0 w-full max-w-[1440px] flex-1 gap-x-8 px-5 md:px-10", !empty && "lg:grid-cols-[264px_minmax(0,1fr)]")}>
          {!empty && (
            <aside className="na-in hidden min-h-0 overflow-y-auto overscroll-contain pb-6 pt-8 lg:block">
              <TripPanel trip={trip} busy={busy} />
            </aside>
          )}

          <div className="flex min-h-0 min-w-0 flex-col">
            {!empty && (
              <div className="shrink-0 pt-4 lg:hidden">
                <TripBar trip={trip} busy={busy} />
              </div>
            )}
            <main ref={box} className="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 md:-mx-10 md:px-10 lg:-mr-10 lg:ml-0 lg:pl-0">
              {empty ? (
                <EmptyState />
              ) : (
                <div ref={content} className="space-y-6 pb-8 pt-6">
                  {turns.map((t) =>
                    t.kind === "settled" ? (
                      <div key={t.key} className="space-y-0.5">
                        {t.messages.map((m) => (
                          <SettledTurn key={m.id} m={m} />
                        ))}
                      </div>
                    ) : t.m.role === "user" ? (
                      <UserMessage key={t.key} m={t.m} />
                    ) : (
                      <AgentMessage key={t.key} m={t.m} writing={busy && t.m === lastAgent} latest={t.m === lastAgent} />
                    ),
                  )}
                </div>
              )}
            </main>
            {/* The message box sits clear of the footer: air below it, a rule above it. */}
            <div className="-mx-5 shrink-0 border-t border-hr-line px-5 pb-5 pt-3 md:-mx-10 md:px-10 md:pb-6 lg:mx-0 lg:px-0">
              <Composer
                onSend={(t) => onSend(t)}
                onStop={stop}
                busy={busy}
                autoFocus
                placeholder={empty ? "Madrid to Athens next Friday, back Sunday…" : trip.pnr ? "Plan another trip…" : "Only non-stop, after 10:00, with a bag…"}
              />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-4">Live airline prices · nothing is charged until you press Pay</p>
            </div>
          </div>
        </div>
        <AppFooter />
      </div>
    </ChatContext.Provider>
  );
}
