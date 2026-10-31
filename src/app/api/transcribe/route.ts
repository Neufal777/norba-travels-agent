import { brainMode } from "@/server/config";
import { ModelError } from "@/server/llm/meta";
import { transcribe } from "@/server/llm/voice";

export const dynamic = "force-dynamic";

/** The transcriber's own limit is 32 MB and ten minutes; a dictated travel request is far less. */
const MAX_BYTES = 6 * 1024 * 1024;

/** Words the recogniser should not mishear in a travel request. */
const KEYWORDS = ["Norba", "non-stop", "Heathrow", "Barajas", "Charles de Gaulle", "Malpensa", "Athens", "Aegean", "Air France", "KLM", "American Airlines"];

const LANGUAGES: Record<string, string> = { es: "Spanish", en: "English", fr: "French", it: "Italian", de: "German", pt: "Portuguese", el: "Greek" };

/** Dictation: a WAV recording in, Muse Voice Transcribe's text out. The audio is not kept. */
export async function POST(req: Request) {
  if (brainMode() !== "meta") return Response.json({ error: "Voice needs MODEL_API_KEY" }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || !audio.size) return Response.json({ error: "No audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "Recording too long" }, { status: 413 });
  const lang = LANGUAGES[String(form?.get("language") ?? "").slice(0, 2).toLowerCase()];
  try {
    const { text } = await transcribe(audio, { languages: lang ? [lang, "English"] : undefined, keywords: KEYWORDS, signal: req.signal });
    return Response.json({ text });
  } catch (e) {
    const status = e instanceof ModelError && e.status === 429 ? 429 : 502;
    return Response.json({ error: status === 429 ? "Too many requests, try again" : "Could not transcribe" }, { status });
  }
}
