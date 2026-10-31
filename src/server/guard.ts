import "server-only";

/*
 * A public demo spends real money on every model call. Two limits keep it in check: requests per visitor per hour on
 * each route that reaches a model or Norba, and model calls per day for the whole app (counted in the model client).
 * Both live in this process's memory, which is all a single-instance deployment needs.
 */

const num = (v: string | undefined, d: number) => (v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : d);

export const limits = {
  /** Chat messages, dictations, desk drafts, checkouts and MCP calls per visitor per hour, each counted on its own. */
  perVisitorPerHour: num(process.env.MAX_REQUESTS_PER_VISITOR_PER_HOUR, 60),
  /** Meta model calls per UTC day across every visitor; 0 turns the cap off. */
  modelCallsPerDay: num(process.env.MAX_MODEL_CALLS_PER_DAY, 1500),
};

type Window = { start: number; count: number };
const store = globalThis as unknown as { __naLimits?: Map<string, Window>; __naModelDay?: { day: string; count: number } };
const windows = (store.__naLimits ??= new Map<string, Window>());

/** The visitor behind a request: the first address in X-Forwarded-For (Render's proxy), else a shared bucket. */
export function visitor(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** A 429 answer when this visitor used up `route` for the hour; undefined while they still may. */
export function limited(req: Request, route: string, max = limits.perVisitorPerHour) {
  if (!max) return undefined;
  const key = `${route}|${visitor(req)}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > 3_600_000) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 20_000) for (const [k, v] of windows) if (now - v.start > 3_600_000) windows.delete(k);
    return undefined;
  }
  if (++w.count <= max) return undefined;
  const retry = Math.ceil((w.start + 3_600_000 - now) / 1000);
  return Response.json({ error: "Too many requests from you for now. Try again later." }, { status: 429, headers: { "Retry-After": String(retry) } });
}

/** Counts one model call against today's cap; false once the cap is reached. */
export function spendModelCall() {
  if (!limits.modelCallsPerDay) return true;
  const day = new Date().toISOString().slice(0, 10);
  const d = (store.__naModelDay ??= { day, count: 0 });
  if (d.day !== day) Object.assign(d, { day, count: 0 });
  if (d.count >= limits.modelCallsPerDay) return false;
  d.count++;
  return true;
}

/** Today's model calls so far, for the status route. */
export const modelCallsToday = () => (store.__naModelDay?.day === new Date().toISOString().slice(0, 10) ? store.__naModelDay.count : 0);
