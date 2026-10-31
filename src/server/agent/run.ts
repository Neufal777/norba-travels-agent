import "server-only";

import type { AgentEvent, FormSubmission } from "@/lib/types";
import { brainMode, config } from "../config";
import { complete } from "../llm/meta";
import type { ChatTurn } from "../llm/types";
import { applyForm } from "./forms";
import { runOffline } from "./offline";
import { systemPrompt, type ClientContext } from "./prompt";
import { TOOLS } from "./registry";
import type { Session } from "./sessions";
import { callTool } from "./steps";
import type { ToolContext, ToolOutcome } from "./tools";
import { publish, step } from "./trip";

/** Model ↔ tool round trips per message: from a search to the payment form fits with room to spare. */
const MAX_ROUNDS = 8;
/** Transcript kept for the model; older turns drop out from a user message on, never splitting a tool exchange. */
const MAX_TURNS = 48;

export type RunInput = { session: Session; text: string; context: ClientContext; emit: (e: AgentEvent) => void; signal?: AbortSignal; form?: FormSubmission };

/** What the planner (model or rules) works from on a turn: the text, or a form's note plus a booking's outcome. */
export type Turn = RunInput & { formNote?: string; booking?: ToolOutcome };

function trim(turns: ChatTurn[]) {
  if (turns.length <= MAX_TURNS) return turns;
  const from = turns.findIndex((t, i) => i >= turns.length - MAX_TURNS && t.role === "user");
  return from > 0 ? turns.slice(from) : turns;
}

export async function runAgent(input: RunInput) {
  const { session, emit, signal } = input;
  const ctx: ToolContext = { session, emit, signal };
  publish(ctx);
  const turn: Turn = { ...input };

  if (input.form) {
    // Throws FormError: the chat shows the reason under the form and nothing moves.
    turn.formNote = applyForm(ctx, input.form);
    // Pressing Pay is the traveller's consent: the booking runs now, not when a model decides to.
    if (input.form.kind === "payment") turn.booking = await callTool("book_trip", {}, ctx);
  } else if (session.trip.view.steps.request.status === "pending") {
    step(ctx, "request", "running", undefined, "Reading your request");
  }

  if (brainMode() === "offline") await runOffline(turn);
  else await runModel(turn, ctx);
  // A request answered without searching (a question, a greeting, a missing date) waits on the traveller.
  if (session.trip.view.steps.request.status === "running") step(ctx, "request", "waiting", "Where, when and who");
}

async function runModel(input: Turn, ctx: ToolContext) {
  const { session, emit, signal } = input;
  const turn = input;

  const content = turn.formNote ? `${turn.formNote}${turn.booking ? `\n[Booking result] ${turn.booking.content}` : ""}` : input.text;
  session.turns.push({ role: "user", content });
  const tools = TOOLS.map((t) => t.schema);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const messages: ChatTurn[] = [{ role: "system", content: systemPrompt(input.context, session.trip) }, ...trim(session.turns)];
    const r = await complete(messages, tools, (delta) => emit({ type: "text", delta }), signal);
    session.turns.push({ role: "assistant", content: r.text || null, ...(r.toolCalls.length ? { tool_calls: r.toolCalls } : {}) });
    if (!r.toolCalls.length) break;
    // Text before a tool call and the text after it are separate paragraphs in the chat.
    if (r.text) emit({ type: "text", delta: "\n\n" });
    for (const call of r.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        session.turns.push({ role: "tool", tool_call_id: call.id, content: "ERROR: the arguments were not valid JSON; call again." });
        continue;
      }
      const out = await callTool(call.function.name, args, ctx);
      session.turns.push({ role: "tool", tool_call_id: call.id, content: out.content });
    }
    if (round === MAX_ROUNDS - 1) emit({ type: "text", delta: "\n\nI stopped there to keep things quick — tell me how to continue." });
  }
}

export const brain = () => ({ mode: brainMode(), model: brainMode() === "meta" ? config.model.id : "offline planner" }) as const;
