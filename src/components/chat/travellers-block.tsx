"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import type { Contact, Passenger, TravellersBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowBox, Button } from "../ui/button";
import { es, useChat } from "./chat-context";
import { Field, Segmented, StepCard, inputClass, useEditable } from "./step-card";

type Draft = Omit<Passenger, "gender" | "document"> & { gender?: "M" | "F"; document: NonNullable<Passenger["document"]> };

const blankDoc = (): Draft["document"] => ({ type: "P", number: "", issuing_country: "", nationality: "", expiry_date: "" });

/** Names as on the passport, dates of birth and the contact: sent to the server only, never to the model. */
export function TravellersResult({ block }: { block: TravellersBlock }) {
  const { send, trip } = useChat();
  const editable = useEditable("travellers");
  const done = trip.steps.travellers.status === "done";
  const [editing, setEditing] = useState(false);
  const [pax, setPax] = useState<Draft[]>(() =>
    block.pax.map((slot) => {
      const known = block.prefill?.passengers.find((p) => p.id === slot.id);
      return { id: slot.id, type: slot.type, first_name: known?.first_name ?? "", last_name: known?.last_name ?? "", date_of_birth: known?.date_of_birth ?? "", gender: known?.gender, document: known?.document ?? blankDoc() };
    }),
  );
  const [contact, setContact] = useState<Contact>(block.prefill?.contact ?? { email: "", phone: "" });
  const [docsOpen, setDocsOpen] = useState<Record<string, boolean>>({});
  const live = editable || (editing && trip.steps.booking.status !== "done");

  const set = (i: number, patch: Partial<Draft>) => setPax((all) => all.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setDoc = (i: number, patch: Partial<Draft["document"]>) => setPax((all) => all.map((p, j) => (j === i ? { ...p, document: { ...p.document, ...patch } } : p)));
  const complete = pax.every((p) => p.first_name.trim() && p.last_name.trim() && p.date_of_birth && p.gender) && contact.email.trim() && contact.phone.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    const passengers: Passenger[] = pax.map((p) => ({
      id: p.id,
      type: p.type,
      first_name: p.first_name.trim(),
      last_name: p.last_name.trim(),
      date_of_birth: p.date_of_birth,
      gender: p.gender!,
      document: p.document.number.trim() ? { ...p.document, issuing_country: p.document.issuing_country.toUpperCase(), nationality: p.document.nationality.toUpperCase() } : undefined,
    }));
    const names = passengers.map((p) => `${p.first_name} ${p.last_name}`).join(", ");
    setEditing(false);
    send(es() ? `Datos de los viajeros: ${names}` : `Traveller details: ${names}`, { kind: "travellers", passengers, contact });
  };

  if (done && !editing)
    return (
      <StepCard step="travellers">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 md:px-5">
          <ul className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-[14px] text-hr-ink-strong">
            {pax.map((p) => (
              <li key={p.id}>
                {p.first_name} {p.last_name}
                <span className="ml-1.5 font-mono text-[10px] text-hr-ink-3">{p.type}</span>
              </li>
            ))}
          </ul>
          <span className="text-[12px] text-hr-ink-3">{contact.email}</span>
          {trip.steps.booking.status !== "done" && (
            <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setEditing(true)}>
              Change
            </Button>
          )}
        </div>
      </StepCard>
    );

  return (
    <StepCard step="travellers">
      <form onSubmit={submit} className="space-y-5 px-4 py-4">
        {pax.map((p, i) => (
          <fieldset key={p.id} disabled={!live} className="space-y-3">
            <legend className="mb-3 flex items-center gap-2 text-[13px] text-hr-ink-strong">
              <span className="grid size-5 place-items-center bg-hr-rust font-mono text-[10px] text-white">{i + 1}</span>
              {block.pax[i].label}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">{(id) => <input id={id} className={inputClass} autoComplete={i ? "off" : "given-name"} value={p.first_name} onChange={(e) => set(i, { first_name: e.target.value })} required maxLength={40} />}</Field>
              <Field label="Last name">{(id) => <input id={id} className={inputClass} autoComplete={i ? "off" : "family-name"} value={p.last_name} onChange={(e) => set(i, { last_name: e.target.value })} required maxLength={40} />}</Field>
              <Field label="Date of birth">{(id) => <input id={id} type="date" className={inputClass} value={p.date_of_birth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set(i, { date_of_birth: e.target.value })} required />}</Field>
              <div className="space-y-1.5">
                <span className="hr-eyebrow block text-[10px]">Gender on the passport</span>
                <Segmented label="Gender" value={p.gender} disabled={!live} onChange={(g) => set(i, { gender: g })} options={[{ value: "F", label: "Female" }, { value: "M", label: "Male" }]} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDocsOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-hr-ink-3 transition-colors hover:text-hr-ink-strong"
            >
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", docsOpen[p.id] && "rotate-180")} />
              Passport or ID card {p.document.number ? "· added" : "· optional, some airlines ask for it"}
            </button>
            {docsOpen[p.id] && (
              <div className="na-in grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <span className="hr-eyebrow block text-[10px]">Document</span>
                  <Segmented label="Document" value={p.document.type} disabled={!live} onChange={(t) => setDoc(i, { type: t })} options={[{ value: "P", label: "Passport" }, { value: "I", label: "ID" }]} />
                </div>
                <Field label="Number">{(id) => <input id={id} className={inputClass} value={p.document.number} onChange={(e) => setDoc(i, { number: e.target.value })} maxLength={20} />}</Field>
                <Field label="Issued by" hint="ES, GB…">{(id) => <input id={id} className={cn(inputClass, "uppercase")} value={p.document.issuing_country} onChange={(e) => setDoc(i, { issuing_country: e.target.value.slice(0, 2) })} maxLength={2} />}</Field>
                <Field label="Nationality" hint="ES, GB…">{(id) => <input id={id} className={cn(inputClass, "uppercase")} value={p.document.nationality} onChange={(e) => setDoc(i, { nationality: e.target.value.slice(0, 2) })} maxLength={2} />}</Field>
                <Field label="Expires">{(id) => <input id={id} type="date" className={inputClass} value={p.document.expiry_date} onChange={(e) => setDoc(i, { expiry_date: e.target.value })} />}</Field>
              </div>
            )}
          </fieldset>
        ))}

        <fieldset disabled={!live} className="space-y-3 border-t border-hr-line pt-5">
          <legend className="sr-only">Contact</legend>
          <p className="hr-eyebrow text-[10px]">Contact for the booking</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">{(id) => <input id={id} type="email" className={inputClass} autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} required />}</Field>
            <Field label="Phone" hint="With country code">{(id) => <input id={id} type="tel" className={inputClass} autoComplete="tel" placeholder="+34 600 000 000" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} required />}</Field>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-[12px] text-hr-ink-3">
            <ShieldCheck className="size-3.5" /> Sent to the airline for this booking — the AI sees first names only.
          </p>
          <Button type="submit" className="cursor-pointer" disabled={!live || !complete}>
            Save travellers <ArrowBox />
          </Button>
        </div>
      </form>
    </StepCard>
  );
}
