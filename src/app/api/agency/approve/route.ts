import { approve } from "@/server/agency";
import { config } from "@/server/config";
import { limited } from "@/server/guard";

export const dynamic = "force-dynamic";

/** The desk approves one option: the airline confirms its price and the client gets a checkout link. */
export async function POST(req: Request) {
  const tooMany = limited(req, "desk-approve");
  if (tooMany) return tooMany;
  const body = (await req.json().catch(() => ({}))) as { draftId?: string; ref?: string };
  if (!body.draftId || !body.ref) return Response.json({ error: "draftId and ref are required" }, { status: 400 });
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3200";
  const base = config.publicUrl || `${req.headers.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https")}://${host}`;
  try {
    return Response.json(await approve(body.draftId, body.ref, base));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
