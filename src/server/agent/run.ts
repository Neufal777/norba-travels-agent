import "server-only";

import type { AgentEvent, Attachment, FormSubmission, VisionBlock } from "@/lib/types";
import { brainMode, config } from "../config";
import { complete, modelLabel } from "../llm/meta";
import type { ChatTurn } from "../llm/types";
import { applyForm } from "./forms";
import { runOffline } from "./offline";
import { systemPrompt, type ClientContext } from "./prompt";
import { TOOLS } from "./registry";
import type { Session } from "./sessions";
import { callTool } from "./steps";
import type { ToolContext, ToolOutcome } from "./tools";
import { publish, step } from "./trip";
import { matchBoard, perceive, perceptionNote } from "./vision";

/** Model ↔ tool round trips per message: from a search to the payment form fits with room to spare. */
const MAX_ROUNDS = 8;
/** Transcript kept for the model; older turns drop out from a user message on, never splitting a tool exchange. */
const MAX_TURNS = 48;

export type RunInput = {
  session: Session;
  text: string;
  context: ClientContext;
  emit: (e: AgentEvent) => void;
  signal?: AbortSignal;
  form?: FormSubmission;
  attachments?: Attachment[];
  /** Where this app is reached from outside, for the checkout links a turn hands out. */
  origin?: string;
};

/**
 * What the planner (model or rules) works from on a turn: the text, or a form's note plus the outcome of what the
 * form ran (a booking, a flight change), and what vision read in the attachments.
 */
export type Turn = RunInput & { formNote?: string; booking?: ToolOutcome; resultLabel?: string; seen?: string[] };

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

  if (input.form?.kind === "change") {
    // Pressing Switch is the traveller's consent to change the booked flight.
    turn.formNote = "[Switch] The traveller pressed Switch on an alternative flight.";
    turn.resultLabel = "Change result";
    turn.booking = await callTool("change_flight", { blockId: input.form.blockId, offerId: input.form.offerId }, ctx);
  } else if (input.form?.kind === "group_hold") {
    // Pressing Hold prices everyone's flights; nobody pays until they open their own link.
    turn.formNote = "[Hold] The traveller pressed Hold seats on the group plan.";
    turn.resultLabel = "Hold result";
    turn.booking = await callTool("hold_group", { blockId: input.form.blockId, baseUrl: input.origin ?? "" }, ctx);
  } else if (input.form) {
    // Throws FormError: the chat shows the reason under the form and nothing moves.
    turn.formNote = applyForm(ctx, input.form);
    // Pressing Pay is the traveller's consent: the booking runs now, not when a model decides to.
    if (input.form.kind === "payment") {
      turn.resultLabel = "Booking result";
      turn.booking = await callTool("book_trip", {}, ctx);
    }
  } else if (session.trip.view.steps.request.status === "pending") {
    step(ctx, "request", "running", undefined, input.attachments?.length ? "Reading what you sent" : "Reading your request");
  }

  if (input.attachments?.length) turn.seen = await see(input);

  if (brainMode() === "offline") await runOffline(turn);
  else await runModel(turn, ctx);
  // A request answered without searching (a question, a greeting, a missing date) waits on the traveller.
  if (session.trip.view.steps.request.status === "running") step(ctx, "request", "waiting", "Where, when and who");
}

async function runModel(input: Turn, ctx: ToolContext) {
  const { session, emit, signal } = input;
  const turn = input;

  const said = turn.formNote ? `${turn.formNote}${turn.booking ? `\n[${turn.resultLabel}] ${turn.booking.content}` : ""}` : input.text;
  const content = turn.seen?.length ? `${said}\n\n${turn.seen.join("\n\n")}` : said;
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

/**
 * Muse Spark reads each attachment before the agent plans: the reading is drawn over the file in the chat, and the
 * transcript keeps the reading, never the file. A departure board is checked against the conversation's bookings.
 */
async function see(input: RunInput) {
  const { session, emit } = input;
  const today = /^\d{4}-\d{2}-\d{2}$/.test(input.context.today ?? "") ? input.context.today! : new Date().toISOString().slice(0, 10);
  const notes: string[] = [];
  for (const a of input.attachments ?? []) {
    const block: VisionBlock = { kind: "vision", id: `v_${a.id}`, attachmentId: a.id, name: a.name, mime: a.mime, model: modelLabel() };
    const stepId = `t_${crypto.randomUUID().slice(0, 8)}`;
    const label = `Reading ${a.name} with Muse Spark`;
    if (brainMode() !== "meta") {
      emit({ type: "block", block: { ...block, error: "Reading files needs Muse Spark: set MODEL_API_KEY." } });
      notes.push(`[Attachment "${a.name}"] It could not be read: the vision model is not configured.`);
      continue;
    }
    emit({ type: "tool", step: { id: stepId, name: "read_attachment", label, status: "running" } });
    emit({ type: "block", block });
    try {
      const p = await perceive(a, today, { signal: input.signal });
      const match = p.kind === "departure_board" ? matchBoard(p, session.orders) : undefined;
      if (match?.disrupted) session.disruption = { orderId: match.order.order_id, sliceIndex: match.sliceIndex };
      emit({
        type: "block",
        block: { ...block, perception: p, match: match && { rowIndex: match.rowIndex, flight: match.row.flight, status: match.row.status, disrupted: match.disrupted, pnr: match.order.pnr } },
      });
      emit({ type: "tool", step: { id: stepId, name: "read_attachment", label, status: "done", detail: p.kind.replace(/_/g, " ") } });
      notes.push(perceptionNote(a, p, match));
    } catch (e) {
      const message = (e as Error).message || "could not be read";
      emit({ type: "block", block: { ...block, error: message } });
      emit({ type: "tool", step: { id: stepId, name: "read_attachment", label, status: "error", detail: "not read" } });
      notes.push(`[Attachment "${a.name}"] It could not be read: ${message}`);
    }
  }
  return notes;
}

export const brain = () => ({ mode: brainMode(), model: brainMode() === "meta" ? config.model.id : "offline planner" }) as const;
