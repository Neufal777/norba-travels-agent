"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStatus } from "../use-status";

/** Muse Voice Transcribe's native rate: mono 16-bit PCM WAV at 24 kHz. */
const RATE = 24_000;
const MAX_SECONDS = 60;

/** Any recording the browser made, as the WAV the transcriber takes. */
async function toWav(recording: Blob) {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await recording.arrayBuffer());
  await ctx.close();
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  out.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, RATE, true);
  out.setUint32(28, RATE * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  text(36, "data");
  out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([out], { type: "audio/wav" });
}

/** Press to talk, press again to stop: the words land in the message box to read before sending. */
export function VoiceButton({ onText, disabled }: { onText: (t: string) => void; disabled?: boolean }) {
  const status = useStatus();
  const [state, setState] = useState<"idle" | "recording" | "reading">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const limit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ready = status?.brain.mode === "meta";

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.message("Microphone not allowed");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearTimeout(limit.current);
      setState("reading");
      try {
        const body = new FormData();
        body.append("audio", await toWav(new Blob(chunks, { type: rec.mimeType })), "speech.wav");
        body.append("language", navigator.language);
        const res = await fetch("/api/transcribe", { method: "POST", body });
        const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) throw new Error(j.error || "Could not transcribe");
        if (j.text) onText(j.text);
        else toast.message("Didn't catch that");
      } catch (e) {
        toast.message((e as Error).message);
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    limit.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000);
  };

  const label = !ready ? "Voice needs Muse Voice Transcribe (MODEL_API_KEY)" : state === "recording" ? "Stop and transcribe" : "Speak — Muse Voice Transcribe";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={state === "recording"}
      disabled={!ready || disabled || state === "reading"}
      onClick={() => (state === "recording" ? recorder.current?.stop() : void start())}
      className={cn(
        "relative grid size-9 cursor-pointer place-items-center border transition-colors duration-300 disabled:cursor-default disabled:opacity-40",
        state === "recording" ? "border-hr-rust bg-hr-rust text-white" : "border-transparent text-hr-ink-3 hover:text-hr-ink-strong",
      )}
    >
      {state === "reading" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
      {state === "recording" && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 animate-ping bg-hr-rust" />}
    </button>
  );
}
