import { createHash } from "node:crypto";
import { brain } from "@/server/agent/run";
import { config, norbaEnvironment, norbaMode } from "@/server/config";
import { limited } from "@/server/guard";
import type { AppStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * What the header shows: which brain answers and which Norba environment the searches reach.
 *
 * `?check=model` also answers, for a deployment that cannot reach its model, what this server actually holds: the
 * base URL's host, the model id, a fingerprint of the key (the first characters of its SHA-256, to compare with the
 * key one expects without showing it) and the models that key lists from here. Listing models generates nothing and
 * costs nothing.
 */
export async function GET(req: Request) {
  const status: AppStatus = { brain: brain(), norba: { mode: norbaMode(), environment: norbaEnvironment(), baseUrl: config.norba.baseUrl } };
  if (new URL(req.url).searchParams.get("check") !== "model") return Response.json(status);

  const tooMany = limited(req, "status-check", 10);
  if (tooMany) return tooMany;
  const m = config.model;
  const check: Record<string, unknown> = {
    baseHost: (() => {
      try {
        return new URL(m.baseUrl).host + new URL(m.baseUrl).pathname;
      } catch {
        return `not a URL (${m.baseUrl.length} chars)`;
      }
    })(),
    modelId: m.id,
    keyFingerprint: m.apiKey ? createHash("sha256").update(m.apiKey).digest("hex").slice(0, 10) : null,
    keyLength: m.apiKey.length,
  };
  if (m.apiKey) {
    try {
      const res = await fetch(`${m.baseUrl}/models`, { headers: { Authorization: `Bearer ${m.apiKey}` }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
      const text = await res.text();
      let ids: string[] | undefined;
      try {
        ids = (JSON.parse(text) as { data?: { id: string }[] }).data?.map((x) => x.id);
      } catch {}
      Object.assign(check, { modelsStatus: res.status, models: ids ?? text.slice(0, 200), modelListed: ids?.includes(m.id) ?? false });
    } catch (e) {
      check.modelsError = (e as Error).message;
    }
  }
  return Response.json({ ...status, check });
}
