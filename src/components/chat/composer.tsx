"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowBox, Button } from "../ui/button";
import { VoiceButton } from "./voice-button";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;
/** A photo's longest side once shrunk: enough for Muse Spark to read a departure board, far lighter to send. */
const MAX_SIDE = 2048;

const uid = () => Math.random().toString(36).slice(2, 10);

const readAsDataUrl = (f: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

/** Photos from a phone are large: shrink them to MAX_SIDE as JPEG. PDFs and small images go as they are. */
async function toAttachment(f: File): Promise<Attachment> {
  if (f.type === "application/pdf" || f.type === "image/gif") return { id: uid(), name: f.name, mime: f.type, data: await readAsDataUrl(f) };
  const bitmap = await createImageBitmap(f);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && f.size < 1.5 * 1024 * 1024) return { id: uid(), name: f.name, mime: f.type, data: await readAsDataUrl(f) };
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { id: uid(), name: f.name.replace(/\.\w+$/, ".jpg"), mime: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.86) };
}

/**
 * The message box: Enter sends, Shift+Enter breaks the line; while the agent writes, Stop replaces Send. Files come
 * in by the clip, by dropping them on the box or by pasting a screenshot; the microphone dictates.
 */
export function Composer({
  onSend,
  onStop,
  busy,
  autoFocus,
  placeholder,
}: {
  onSend: (t: string, attachments: Attachment[]) => void;
  onStop: () => void;
  busy: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);

  const add = async (list: FileList | File[]) => {
    const picked = [...list].filter((f) => ACCEPT.includes(f.type));
    if (picked.length < list.length) toast.message("Only images and PDFs");
    const room = MAX_FILES - files.length;
    if (picked.length > room) toast.message(`Up to ${MAX_FILES} files per message`);
    try {
      const made = await Promise.all(picked.slice(0, Math.max(0, room)).map(toAttachment));
      const fits = made.filter((a) => Math.floor((a.data.length * 3) / 4) <= MAX_BYTES);
      if (fits.length < made.length) toast.message("Files up to 8 MB");
      setFiles((all) => [...all, ...fits]);
    } catch {
      toast.message("That file could not be opened");
    }
  };

  const submit = () => {
    if ((!text.trim() && !files.length) || busy) return;
    onSend(text, files);
    setText("");
    setFiles([]);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void add(e.dataTransfer.files);
      }}
      className={cn(
        "border border-hr-border-cta bg-hr-panel transition-[border-color,box-shadow] duration-300 focus-within:border-hr-ink-strong focus-within:shadow-[inset_2px_0_0_var(--hr-rust)]",
        dragging && "border-hr-rust shadow-[inset_2px_0_0_var(--hr-rust)]",
      )}
    >
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-3 pt-3">
          {files.map((f) => (
            <li key={f.id} className="na-in group relative flex h-14 items-center gap-2 border border-hr-line-strong bg-hr-surface-2 pr-2">
              {f.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing to optimise
                <img src={f.data} alt="" className="h-full w-14 object-cover" />
              ) : (
                <span className="grid h-full w-12 place-items-center text-hr-ink-3">
                  <FileText className="size-5" />
                </span>
              )}
              <span className="max-w-36 truncate text-[12px] text-hr-ink-2">{f.name}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((all) => all.filter((x) => x.id !== f.id))}
                className="grid size-6 cursor-pointer place-items-center text-hr-ink-3 transition-colors hover:text-hr-ink-strong"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end">
        <input
          ref={picker}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          aria-label="Attach a photo, screenshot or PDF"
          title="Attach a photo, screenshot or PDF"
          disabled={busy || files.length >= MAX_FILES}
          onClick={() => picker.current?.click()}
          className="grid size-12 shrink-0 cursor-pointer place-items-center text-hr-ink-3 transition-colors hover:text-hr-ink-strong disabled:cursor-default disabled:opacity-40"
        >
          <Paperclip className="size-4" />
        </button>
        <label htmlFor="na-message" className="sr-only">
          Message
        </label>
        <textarea
          id="na-message"
          ref={ref}
          rows={1}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = [...e.clipboardData.files];
            if (pasted.length) {
              e.preventDefault();
              void add(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={dragging ? "Drop it here" : (placeholder ?? "Where do you want to go?")}
          className="field-sizing-content max-h-40 min-h-12 flex-1 resize-none bg-transparent py-3.5 pr-2 text-[14px] leading-[1.5] text-hr-ink-strong outline-none placeholder:text-hr-ink-4"
        />
        <div className="flex items-center gap-1 p-1.5">
          <VoiceButton disabled={busy} onText={(t) => setText((now) => (now.trim() ? `${now.trimEnd()} ${t}` : t))} />
          {busy ? (
            <Button type="button" variant="outline" onClick={onStop} className="cursor-pointer">
              <Square className="size-3" /> Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!text.trim() && !files.length} className="cursor-pointer">
              Send <ArrowBox />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
