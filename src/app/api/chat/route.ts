import { FormError } from "@/server/agent/forms";
import { brain, runAgent } from "@/server/agent/run";
import { session } from "@/server/agent/sessions";
import { ModelError } from "@/server/llm/meta";
import type { AgentEvent, FormSubmission } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_MESSAGE = 2000;

type Body = { conversationId?: string; message?: string; form?: FormSubmission; context?: { today?: string; timeZone?: string; locale?: string } };

const FORMS = ["seats", "extras", "travellers", "payment"];

/** One chat turn: the agent's events as NDJSON (one JSON object per line), ending with `done` or `error`. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const text = (body.message ?? "").trim();
  if (!text) return Response.json({ error: "message is required" }, { status: 400 });
  if (text.length > MAX_MESSAGE) return Response.json({ error: `at most ${MAX_MESSAGE} characters` }, { status: 413 });
  if (body.form && !FORMS.includes(body.form.kind)) return Response.json({ error: "unknown form" }, { status: 400 });

  const s = session(body.conversationId);
  if (s.busy) return Response.json({ error: "still answering the previous message" }, { status: 409 });
  s.busy = true;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (e: AgentEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false;
        }
      };
      emit({ type: "start", conversationId: s.id, brain: brain() });
      try {
        await runAgent({ session: s, text, context: body.context ?? {}, emit, signal: req.signal, form: body.form });
        emit({ type: "done" });
      } catch (e) {
        if (!req.signal.aborted) {
          const message =
            e instanceof FormError
              ? e.message
              : e instanceof ModelError
              ? e.status === 401 || e.status === 403
                ? "The Meta Model API refused the key. Check MODEL_API_KEY."
                : e.message
              : (e as Error)?.message || "Something went wrong";
          // Never log a form's body: it can hold a card number.
          if (!(e instanceof FormError)) console.error("[chat]", e instanceof Error ? e.message : "error");
          emit({ type: "error", message });
        }
      } finally {
        s.busy = false;
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
