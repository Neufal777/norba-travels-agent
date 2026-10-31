"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Copy, FileText, Mail, MessageCircle, ShieldCheck, ShieldX, Upload } from "lucide-react";
import { toast } from "sonner";
import { NorbaWordmark } from "@/components/brand";
import { AppFooter } from "@/components/app-footer";
import { Check, Pulse, Sq } from "@/components/status";
import { ArrowBox, Button } from "@/components/ui/button";
import { airlineName } from "@/lib/airlines";
import { clock, dateLabel, dayPart, duration, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DeskEvent, DeskOption, DeskReading, DeskStep } from "@/server/agency";

type Request = { id: string; channel: "email" | "whatsapp"; from: string; company: string; at: string; text: string };

/** A morning's inbox at a travel agency. People and companies are invented. */
const INBOX: Request[] = [
  {
    id: "r1",
    channel: "email",
    from: "Claire Martin",
    company: "Acme Corp",
    at: "08:12",
    text: "Hi! I need to be in Athens for a client meeting on Wednesday 9 December at 10:00. I'm flying from Paris and coming back Thursday evening. Business class please, as usual. Thanks, Claire",
  },
  { id: "r2", channel: "whatsapp", from: "Jonas Weber", company: "Acme Corp", at: "08:47", text: "Hey! Can you get me Madrid to London Heathrow next Monday morning, back Friday? Economy is fine, carry-on only." },
  { id: "r3", channel: "email", from: "Sofia Russo", company: "Acme Corp", at: "09:05", text: "Hello, Milan to Athens from 18 to 21 December for two of us (me and a colleague). We'd rather fly non-stop. Best, Sofia" },
];

const POLICY = `Acme Corp — Air travel policy (2026)
1. Economy class on flights under 4 hours. Business class only when the flight is 4 hours or longer.
2. Premium economy is allowed on flights over 6 hours.
3. Maximum fare per traveller: €900 return within Europe.
4. Prefer non-stop flights when they cost less than 20% more than a connection.
5. Book at least 7 days before departure.`;

type Model = { mode: "open" | "meta" | "offline"; label: string; partner: string };

async function* lines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const all = buf.split("\n");
    buf = all.pop() ?? "";
    for (const l of all) if (l.trim()) yield JSON.parse(l) as DeskEvent;
  }
}

function OptionRow({ o, onApprove, approved, busy }: { o: DeskOption; onApprove: () => void; approved?: string; busy: boolean }) {
  return (
    <li className={cn("grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", !o.compliant && "bg-hr-alert/5")}>
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] tabular-nums text-hr-ink-strong">
          <span className="font-mono text-[10.5px] text-hr-ink-3">{o.ref}</span>
          {clock(o.outbound.departure_utc)} {o.outbound.origin} → {clock(o.outbound.arrival_utc)} {o.outbound.destination}
          <span className="text-[11.5px] text-hr-ink-3">
            {dateLabel(dayPart(o.outbound.departure_utc))} · {duration(o.outbound.duration_minutes)} · {o.outbound.stops ? `${o.outbound.stops} stop` : "non-stop"}
            {o.inbound && ` · back ${dateLabel(dayPart(o.inbound.departure_utc))} ${clock(o.inbound.departure_utc)}`}
          </span>
        </p>
        <p className="text-[11.5px] text-hr-ink-3">
          {airlineName(o.airline)} · {o.cabin.replace("_", " ")}
        </p>
        <p className={cn("flex items-start gap-1.5 text-[12px]", o.compliant ? "text-hr-success" : "text-hr-alert")}>
          {o.compliant ? <ShieldCheck className="mt-px size-3.5 shrink-0" /> : <ShieldX className="mt-px size-3.5 shrink-0" />}
          {o.compliant ? "Within policy" : o.violations.join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <span className="text-[16px] tabular-nums text-hr-ink-strong">{money(o.total, o.currency)}</span>
        {approved ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-success">
            <Check className="text-hr-success" /> Approved
          </span>
        ) : (
          <Button size="xs" variant={o.compliant ? "default" : "outline"} className="h-7 cursor-pointer px-2.5" disabled={busy || !o.compliant} onClick={onApprove} title={o.compliant ? undefined : "Out of policy"}>
            Approve <ArrowBox />
          </Button>
        )}
      </div>
    </li>
  );
}

/** The agency desk: an inbox of client requests, the company's travel policy, and the agent's draft for each. */
export function AgencyDesk({ model }: { model: Model }) {
  const [selected, setSelected] = useState<Request>(INBOX[0]);
  const [text, setText] = useState(INBOX[0].text);
  const [policy, setPolicy] = useState(POLICY);
  const [pdf, setPdf] = useState<{ name: string; data: string } | undefined>();
  const [steps, setSteps] = useState<DeskStep[]>([]);
  const [reading, setReading] = useState<DeskReading>();
  const [options, setOptions] = useState<DeskOption[]>([]);
  const [summary, setSummary] = useState("");
  const [reply, setReply] = useState<{ subject: string; body: string }>();
  const [draftId, setDraftId] = useState<string>();
  const [link, setLink] = useState<{ ref: string; url: string; total: number; currency: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  const pick = (r: Request) => {
    setSelected(r);
    setText(r.text);
    setSteps([]);
    setReading(undefined);
    setOptions([]);
    setReply(undefined);
    setDraftId(undefined);
    setLink(undefined);
    setError("");
  };

  const run = async () => {
    pick({ ...selected, text });
    setBusy(true);
    try {
      const res = await fetch("/api/agency/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: `From ${selected.from} (${selected.company}) by ${selected.channel}:\n${text}`, policy: pdf ? undefined : policy, policyPdf: pdf?.data, policyName: pdf?.name, today: new Date().toLocaleDateString("en-CA") }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `The desk answered ${res.status}`);
      for await (const e of lines(res.body)) {
        if (e.type === "step") setSteps((all) => (all.some((s) => s.id === e.step.id) ? all.map((s) => (s.id === e.step.id ? e.step : s)) : [...all, e.step]));
        else if (e.type === "reading") setReading(e.reading);
        else if (e.type === "options") {
          setOptions(e.options);
          setSummary(e.summary);
        }
        else if (e.type === "reply") setReply({ subject: e.subject, body: e.body });
        else if (e.type === "draft") setDraftId(e.draftId);
        else if (e.type === "error") setError(e.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async (o: DeskOption) => {
    if (!draftId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/agency/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId, ref: o.ref }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setLink({ ref: o.ref, url: j.url, total: j.total, currency: j.currency });
    } catch (e) {
      toast.message((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast.message("Copied"));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hr-frost border-b border-hr-line">
        <div className="mx-auto flex h-12 w-full max-w-[1120px] items-center gap-4 px-5 md:px-10">
          <NorbaWordmark sub="Agency desk" />
          <span className="ml-auto hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 sm:inline-flex">
            <Sq className={model.mode === "open" ? "bg-hr-success" : "bg-hr-concrete"} /> {model.label}
          </span>
          <Link href="/" className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 no-underline hover:text-hr-ink-strong">
            <ArrowLeft className="size-3" /> Traveller agent
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1120px] flex-1 gap-6 px-5 py-6 md:px-10 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="border border-hr-line-strong/70 bg-hr-panel">
            <p className="hr-eyebrow border-b border-hr-line px-4 py-2.5 text-[10px]">Inbox · {INBOX.length}</p>
            <ul className="divide-y divide-hr-line">
              {INBOX.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => pick(r)} className={cn("w-full cursor-pointer space-y-1 px-4 py-3 text-left transition-colors hover:bg-hr-highlight", selected.id === r.id && "bg-hr-highlight shadow-[inset_2px_0_0_var(--hr-rust)]")}>
                    <span className="flex items-center gap-2 text-[13px] text-hr-ink-strong">
                      {r.channel === "email" ? <Mail className="size-3.5 text-hr-ink-3" /> : <MessageCircle className="size-3.5 text-hr-ink-3" />}
                      {r.from}
                      <span className="ml-auto font-mono text-[10px] text-hr-ink-4">{r.at}</span>
                    </span>
                    <span className="line-clamp-2 block text-[12px] text-hr-ink-3">{r.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="border border-hr-line-strong/70 bg-hr-panel">
            <div className="flex items-center justify-between border-b border-hr-line px-4 py-2.5">
              <p className="hr-eyebrow text-[10px]">Travel policy · Acme Corp</p>
              <input
                ref={picker}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => setPdf({ name: f.name, data: r.result as string });
                  r.readAsDataURL(f);
                  e.target.value = "";
                }}
              />
              <button type="button" onClick={() => picker.current?.click()} className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3 hover:text-hr-ink-strong">
                <Upload className="size-3" /> PDF
              </button>
            </div>
            {pdf ? (
              <div className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-hr-ink-2">
                <FileText className="size-4" /> {pdf.name}
                <button type="button" onClick={() => setPdf(undefined)} className="ml-auto cursor-pointer text-[11px] text-hr-ink-3 hover:text-hr-ink-strong">
                  Use text
                </button>
              </div>
            ) : (
              <textarea value={policy} onChange={(e) => setPolicy(e.target.value)} rows={9} className="w-full resize-y bg-transparent px-4 py-3 text-[12px] leading-[1.55] text-hr-ink-2 outline-none" />
            )}
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="border border-hr-line-strong/70 bg-hr-panel">
            <div className="flex flex-wrap items-center gap-2 border-b border-hr-line px-4 py-2.5 text-[13px]">
              <span className="text-hr-ink-strong">{selected.from}</span>
              <span className="text-hr-ink-3">· {selected.company} · {selected.channel === "email" ? "Email" : "WhatsApp"}</span>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full resize-y bg-transparent px-4 py-3 text-[14px] leading-[1.55] text-hr-ink-strong outline-none" />
            <div className="flex items-center justify-between gap-3 border-t border-hr-line px-4 py-2.5">
              <p className="text-[11.5px] text-hr-ink-3">Reads the request, searches the airlines, applies the policy, drafts the reply.</p>
              <Button size="sm" className="cursor-pointer" disabled={busy || !text.trim() || model.mode === "offline"} onClick={run}>
                {busy && !draftId ? "Drafting…" : "Draft with the agent"} <ArrowBox />
              </Button>
            </div>
          </div>

          {steps.length > 0 && (
            <ol className="space-y-1.5">
              {steps.map((s) => (
                <li key={s.id} className="na-in flex flex-wrap items-center gap-x-3 font-mono text-[11px] uppercase tracking-[0.04em]">
                  <span className="inline-grid size-4 place-items-center">{s.status === "running" ? <Pulse /> : s.status === "done" ? <Check className="text-hr-success" /> : <Sq className="bg-hr-alert" />}</span>
                  <span className={s.status === "failed" ? "text-hr-alert" : "text-hr-ink-strong"}>{s.label}</span>
                  {s.detail && <span className="normal-case tracking-normal text-hr-ink-3">· {s.detail}</span>}
                  {s.model && <span className="border border-hr-line px-1.5 py-0.5 text-[9.5px] text-hr-ink-3">{s.model}</span>}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="text-[13px] text-hr-alert">{error}</p>}

          {reading && (
            <ul className="flex flex-wrap gap-1.5">
              {[
                ["Traveller", reading.traveller_name],
                ["Route", `${reading.origin} → ${reading.destination}`],
                ["Dates", `${reading.depart_date}${reading.return_date ? ` – ${reading.return_date}` : ""}`],
                ["Asked for", reading.cabin.replace("_", " ")],
                ...(reading.notes ? [["Notes", reading.notes]] : []),
              ].map(([k, v]) => (
                <li key={k} className="na-in inline-flex items-center gap-1.5 border border-hr-line px-2 py-1 text-[12px]">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.04em] text-hr-ink-3">{k}</span>
                  <span className="text-hr-ink-strong">{v}</span>
                </li>
              ))}
            </ul>
          )}

          {options.length > 0 && (
            <section className="na-in border border-hr-line-strong/70 bg-hr-panel">
              <p className="border-b border-hr-line px-4 py-2.5 text-[13px] text-hr-ink-strong">{summary}</p>
              <ul className="divide-y divide-hr-line">
                {options.map((o) => (
                  <OptionRow key={o.ref} o={o} busy={busy} approved={link?.ref === o.ref ? link.url : undefined} onApprove={() => approve(o)} />
                ))}
              </ul>
            </section>
          )}

          {reply && (
            <section className="na-in border border-hr-ink-strong bg-hr-panel">
              <div className="flex items-center justify-between gap-3 border-b border-hr-line px-4 py-2.5">
                <p className="text-[13px] text-hr-ink-strong">
                  <span className="hr-eyebrow mr-2 text-[10px]">Reply</span> {reply.subject}
                </p>
                <button type="button" onClick={() => copy(`${reply.subject}\n\n${reply.body}${link ? `\n\nBook here: ${link.url}` : ""}`)} className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-hr-ink-3 hover:text-hr-ink-strong">
                  <Copy className="size-3" /> Copy{link ? " with link" : ""}
                </button>
              </div>
              <textarea value={reply.body + (link ? `\n\nBook here: ${link.url}` : "")} onChange={(e) => setReply({ ...reply, body: e.target.value })} rows={10} className="w-full resize-y bg-transparent px-4 py-3 text-[13.5px] leading-[1.6] text-hr-ink-2 outline-none" />
              {link && (
                <p className="flex flex-wrap items-center gap-2 border-t border-hr-line px-4 py-2.5 text-[12px] text-hr-ink-3">
                  <Check className="text-hr-success" /> Price confirmed by the airline: {money(link.total, link.currency, { cents: true })} ·
                  <a href={link.url} target="_blank" rel="noreferrer" className="cursor-pointer text-hr-ink-strong underline underline-offset-2">
                    checkout link
                  </a>
                </p>
              )}
            </section>
          )}
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
