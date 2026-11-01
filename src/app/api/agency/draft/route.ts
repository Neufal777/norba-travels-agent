import { draft, type DeskEvent } from "@/server/agency";
import { brainMode } from "@/server/config";
import { dataUrlBytes, MAX_ATTACHMENT_BYTES } from "@/server/agent/vision";
import { limited, limits } from "@/server/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { request?: string; policy?: string; policyPdf?: string; policyName?: string; today?: string };

/** One request drafted at the agency desk, streamed as NDJSON: each step, the reading, the checked options, the reply. */
export async function POST(req: Request) {
  // A draft is four model calls: the desk gets a quarter of the chat's allowance.
  const tooMany = limited(req, "desk", Math.ceil(limits.perVisitorPerHour / 4));
  if (tooMany) return tooMany;
  if (brainMode() === "offline") return Response.json({ error: "The desk needs Muse Spark: set MODEL_API_KEY." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const request = (body.request ?? "").trim().slice(0, 4000);
  if (!request) return Response.json({ error: "Paste the client's request" }, { status: 400 });
  const pdf = body.policyPdf?.startsWith("data:application/pdf;base64,") ? body.policyPdf : undefined;
  if (pdf && dataUrlBytes(pdf) > MAX_ATTACHMENT_BYTES) return Response.json({ error: "The policy PDF is over 8 MB" }, { status: 413 });
  if (pdf && brainMode() !== "meta") return Response.json({ error: "Reading a PDF needs Muse Spark (MODEL_API_KEY)" }, { status: 503 });
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : new Date().toISOString().slice(0, 10);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: DeskEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {}
      };
      try {
        await draft(request, { text: body.policy?.slice(0, 8000), pdf, name: body.policyName }, today, emit, req.signal);
      } catch (e) {
        if (!req.signal.aborted) emit({ type: "error", message: (e as Error).message || "The draft failed" });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
