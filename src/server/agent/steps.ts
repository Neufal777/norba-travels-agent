import "server-only";

import { learnPlaces } from "./places";
import { toolByName } from "./registry";
import type { ToolContext, ToolOutcome } from "./tools";

/** Runs one tool the way the chat expects: a step that starts, then ends done or failed with a short detail. */
export async function callTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  const tool = toolByName(name);
  const id = `t_${crypto.randomUUID().slice(0, 8)}`;
  if (!tool) return { content: `ERROR: unknown tool ${name}` };
  if (tool.places) await learnPlaces(ctx, tool.places(args));
  const label = tool.label(args, ctx);
  ctx.emit({ type: "tool", step: { id, name, label, status: "running" } });
  const out = await tool.run(args, ctx);
  ctx.emit({ type: "tool", step: { id, name, label, status: out.content.startsWith("ERROR") ? "error" : "done", detail: out.detail } });
  return out;
}
