"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyTrip } from "@/lib/steps";
import type { AgentEvent, Attachment, Block, Brain, ChatMessage, ChatPart, FormSubmission, TripView } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Applies one streamed event to the assistant message being written. */
function apply(parts: ChatPart[], e: AgentEvent): ChatPart[] {
  switch (e.type) {
    case "text": {
      const last = parts.at(-1);
      if (last?.kind === "text") return [...parts.slice(0, -1), { kind: "text", text: last.text + e.delta }];
      // A paragraph break that arrives before any text after a tool has nothing to separate.
      if (!e.delta.trim()) return parts;
      return [...parts, { kind: "text", text: e.delta }];
    }
    case "tool": {
      const i = parts.findIndex((p) => p.kind === "tool" && p.step.id === e.step.id);
      return i >= 0 ? parts.map((p, j) => (j === i ? { kind: "tool", step: e.step } : p)) : [...parts, { kind: "tool", step: e.step }];
    }
    case "block":
    case "offers_final": {
      const i = parts.findIndex((p) => p.kind === "block" && p.block.id === e.block.id);
      return i >= 0 ? parts.map((p, j) => (j === i ? { kind: "block", block: e.block } : p)) : [...parts, { kind: "block", block: e.block }];
    }
    case "offers_append":
      return parts.map((p) => {
        if (p.kind !== "block" || p.block.id !== e.blockId || p.block.kind !== "offers") return p;
        const b = p.block;
        return { kind: "block", block: { ...b, offers: [...b.offers, ...e.offers], airlines: [...new Set([...b.airlines, ...e.airlines])] } as Block };
      });
    default:
      return parts;
  }
}

async function* lines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const all = buf.split("\n");
    buf = all.pop() ?? "";
    for (const l of all) if (l.trim()) yield JSON.parse(l) as AgentEvent;
  }
  if (buf.trim()) yield JSON.parse(buf) as AgentEvent;
}

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [trip, setTrip] = useState<TripView>(emptyTrip);
  const [places, setPlaces] = useState<Record<string, string>>({});
  const conversation = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const patch = (id: string, fn: (m: ChatMessage) => ChatMessage) => setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));
  /** A block from an earlier message (a rebooking switched, a friend's group seat paid) moves on, wherever it is. */
  const replaceBlock = (block: Block) =>
    setMessages((all) => all.map((m) => (m.parts.some((p) => p.kind === "block" && p.block.id === block.id) ? { ...m, parts: m.parts.map((p) => (p.kind === "block" && p.block.id === block.id ? { kind: "block", block } : p)) } : m)));
  const seen = useRef(0);

  const send = useCallback(
    /** `form` sends a form's answer; `raw` is then the line the traveller sees, never the details themselves. */
    async (raw: string, form?: FormSubmission, attachments: Attachment[] = []) => {
      const text = raw.trim();
      if ((!text && !attachments.length) || busy) return;
      const reply: ChatMessage = { id: uid(), role: "assistant", parts: [], at: Date.now() };
      const mine: ChatMessage = { id: uid(), role: "user", parts: text ? [{ kind: "text", text }] : [], at: Date.now(), form: form?.kind, attachments: attachments.length ? attachments : undefined };
      setMessages((all) => [...all, mine, reply]);
      setBusy(true);
      const ac = new AbortController();
      abort.current = ac;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversation.current,
            message: text,
            form,
            attachments: attachments.length ? attachments : undefined,
            context: { today: new Date().toLocaleDateString("en-CA"), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: navigator.language },
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `The agent answered ${res.status}`);
        }
        for await (const e of lines(res.body)) {
          if (e.type === "start") {
            conversation.current = e.conversationId;
            setBrain(e.brain);
          } else if (e.type === "trip") {
            setTrip(e.trip);
          } else if (e.type === "places") {
            setPlaces((known) => ({ ...known, ...e.places }));
          } else if (e.type === "patch") {
            replaceBlock(e.block);
          } else if (e.type === "error") {
            patch(reply.id, (m) => ({ ...m, failed: e.message }));
          } else if (e.type !== "done") {
            patch(reply.id, (m) => ({ ...m, parts: apply(m.parts, e) }));
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") patch(reply.id, (m) => ({ ...m, failed: (err as Error).message }));
      } finally {
        // A step still marked running when the stream ends was cut short.
        patch(reply.id, (m) => ({ ...m, parts: m.parts.map((p) => (p.kind === "tool" && p.step.status === "running" ? { ...p, step: { ...p.step, status: "error", detail: "stopped" } } : p)) }));
        setBusy(false);
        abort.current = null;
      }
    },
    [busy],
  );

  // Between messages the conversation can still move: a friend pays their link, an airline moves a flight.
  useEffect(() => {
    if (busy) return;
    const id = setInterval(async () => {
      if (!conversation.current || document.hidden) return;
      try {
        const r = await fetch(`/api/updates?c=${encodeURIComponent(conversation.current)}&after=${seen.current}`, { cache: "no-store" });
        const j = (await r.json()) as { seq: number; events: AgentEvent[] };
        seen.current = Math.max(seen.current, j.seq);
        for (const e of j.events) {
          if (e.type === "patch") replaceBlock(e.block);
          else if (e.type === "trip") setTrip(e.trip);
          // An airline notice: the agent takes it at once, as if the traveller had forwarded it.
          else if (e.type === "notice") void sendRef.current("Airline notice", { kind: "notice", noticeId: e.noticeId });
        }
      } catch {}
    }, 4000);
    return () => clearInterval(id);
  }, [busy]);

  const sendRef = useRef(send);
  sendRef.current = send;

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(() => {
    abort.current?.abort();
    conversation.current = undefined;
    seen.current = 0;
    setMessages([]);
    setTrip(emptyTrip());
  }, []);

  return { messages, busy, brain, trip, places, send, stop, reset, conversationId: () => conversation.current };
}
