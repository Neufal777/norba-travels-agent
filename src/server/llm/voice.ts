import "server-only";

import { config } from "../config";
import { budget, ModelError } from "./meta";

/**
 * Muse Voice Transcribe: POST {base}/asr/transcribe, multipart with a JSON `request` part and the `audio` part.
 * The audio is WAV, mono, 16-bit PCM at 16 or 24 kHz; the browser encodes it that way before sending.
 */
export async function transcribe(wav: Blob, opts: { languages?: string[]; keywords?: string[]; signal?: AbortSignal } = {}) {
  budget();
  const request: Record<string, unknown> = { mode: "PUSH_TO_TALK", model: config.voice.id, audioEncoding: "WAV" };
  if (opts.languages?.length) request.languageBias = opts.languages;
  // Airport and airline words the recogniser would otherwise spell as common words.
  if (opts.keywords?.length) request.keywords = opts.keywords;
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
  form.append("audio", wav, "speech.wav");
  const res = await fetch(`${config.model.baseUrl}/asr/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.model.apiKey}`, Accept: "application/json" },
    body: form,
    signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ModelError(`Muse Voice Transcribe ${res.status}: ${text.slice(0, 200) || res.statusText}`, res.status);
  }
  const j = (await res.json()) as { transcript?: string; audioDurationMs?: number };
  return { text: (j.transcript ?? "").trim(), durationMs: j.audioDurationMs ?? 0 };
}
