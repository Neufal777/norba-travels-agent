import { brainMode } from "@/server/config";
import { ModelError } from "@/server/llm/meta";
import { transcribe } from "@/server/llm/voice";
import { limited } from "@/server/guard";

export const dynamic = "force-dynamic";

/** The transcriber's own limit is 32 MB and ten minutes; a dictated travel request is far less. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Airport names the recogniser would otherwise spell as common words. Only names that read the same in every language:
 * English words here pull a Spanish sentence towards English.
 */
const KEYWORDS = ["Barajas", "Heathrow", "Gatwick", "Malpensa", "Fiumicino", "Schiphol"];

const LANGUAGES: Record<string, string> = { es: "Spanish", en: "English", fr: "French", it: "Italian", de: "German", pt: "Portuguese", el: "Greek" };

/** Dictation: a WAV recording in, Muse Voice Transcribe's text out. The audio is not kept. */
export async function POST(req: Request) {
  const tooMany = limited(req, "transcribe");
  if (tooMany) return tooMany;
  if (brainMode() !== "meta") return Response.json({ error: "Voice needs MODEL_API_KEY" }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || !audio.size) return Response.json({ error: "No audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "Recording too long" }, { status: 413 });
  const lang = LANGUAGES[String(form?.get("language") ?? "").slice(0, 2).toLowerCase()];
  try {
    // The browser's language alone: a second one makes the recogniser mix them.
    const { text } = await transcribe(audio, { languages: lang ? [lang] : undefined, keywords: KEYWORDS, signal: req.signal });
    return Response.json({ text });
  } catch (e) {
    const status = e instanceof ModelError && e.status === 429 ? 429 : 502;
    return Response.json({ error: status === 429 ? "Too many requests, try again" : "Could not transcribe" }, { status });
  }
}
