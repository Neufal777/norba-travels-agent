"use client";

import { useState } from "react";
import { Check, Sq } from "@/components/status";
import { ArrowBox, Button } from "@/components/ui/button";
import { Field, Segmented, inputClass } from "@/components/chat/step-card";
import type { PaxSlot } from "@/lib/types";

type Person = { first_name: string; last_name: string; date_of_birth: string; gender?: "M" | "F" };

/** The travellers' names as on the passport, a contact and the card; Pay books it with the airline. */
export function PayForm({ token, slots, total, expired, test, paid }: { token: string; slots: PaxSlot[]; total: string; expired: boolean; test: boolean; paid?: { pnr: string; status: string } }) {
  const [people, setPeople] = useState<Person[]>(slots.map(() => ({ first_name: "", last_name: "", date_of_birth: "" })));
  const [contact, setContact] = useState({ email: "", phone: "" });
  const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvv: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(paid);

  const set = (i: number, patch: Partial<Person>) => setPeople((all) => all.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const m = card.expiry.replace(/\s/g, "").match(/^(\d{1,2})\/?(\d{2,4})$/);
    if (!m) return setError("Card expiry as MM/YY.");
    setBusy(true);
    try {
      const res = await fetch(`/api/pay/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengers: people.map((p, i) => ({ id: slots[i].id, type: slots[i].type, ...p })),
          contact,
          card: { number: card.number, holder: card.holder, expiry_month: Number(m[1]), expiry_year: Number(m[2]), cvv: card.cvv || undefined },
          locale: navigator.language,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "The booking could not be made.");
      setDone({ pnr: j.order.pnr ?? j.order.order_id, status: j.order.status });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setCard((c) => ({ ...c, number: "", cvv: "" }));
    }
  };

  if (done)
    return (
      <section className="na-in mt-6 border border-hr-ink-strong bg-hr-panel px-5 py-6 shadow-[inset_2px_0_0_var(--hr-success)]">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-success">
          <Check className="text-hr-success" /> Booked · {done.status}
        </p>
        <p className="mt-3 text-[13px] text-hr-ink-3">Booking reference</p>
        <p className="font-mono text-[34px] tracking-[0.08em] text-hr-ink-strong">{done.pnr}</p>
      </section>
    );

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      {slots.map((s, i) => (
        <fieldset key={s.id} className="space-y-3 border border-hr-line-strong/70 bg-hr-panel p-4">
          <legend className="hr-eyebrow px-1 text-[10px]">{s.label} · as on the passport</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name">{(id) => <input id={id} className={inputClass} value={people[i].first_name} onChange={(e) => set(i, { first_name: e.target.value })} autoComplete="given-name" required />}</Field>
            <Field label="Last name">{(id) => <input id={id} className={inputClass} value={people[i].last_name} onChange={(e) => set(i, { last_name: e.target.value })} autoComplete="family-name" required />}</Field>
            <Field label="Date of birth">{(id) => <input id={id} type="date" className={inputClass} value={people[i].date_of_birth} onChange={(e) => set(i, { date_of_birth: e.target.value })} required />}</Field>
            <div className="space-y-1.5">
              <p className="hr-eyebrow text-[10px]">Gender</p>
              <Segmented label="Gender" value={people[i].gender} options={[{ value: "F", label: "Female" }, { value: "M", label: "Male" }]} onChange={(g) => set(i, { gender: g })} />
            </div>
          </div>
        </fieldset>
      ))}

      <fieldset className="grid gap-3 border border-hr-line-strong/70 bg-hr-panel p-4 sm:grid-cols-2">
        <legend className="hr-eyebrow px-1 text-[10px]">Contact</legend>
        <Field label="Email">{(id) => <input id={id} type="email" className={inputClass} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" required />}</Field>
        <Field label="Phone">{(id) => <input id={id} type="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" placeholder="+34 600 000 000" required />}</Field>
      </fieldset>

      <fieldset className="grid gap-3 border border-hr-line-strong/70 bg-hr-panel p-4 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
        <legend className="hr-eyebrow px-1 text-[10px]">Card</legend>
        <Field label="Card number" className="sm:col-span-3">
          {(id) => <input id={id} inputMode="numeric" className={`${inputClass} font-mono`} value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} autoComplete="cc-number" placeholder="1234 1234 1234 1234" required />}
        </Field>
        <Field label="Name on the card">{(id) => <input id={id} className={inputClass} value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} autoComplete="cc-name" required />}</Field>
        <Field label="Expiry">{(id) => <input id={id} className={`${inputClass} font-mono`} value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} autoComplete="cc-exp" placeholder="MM/YY" required />}</Field>
        <Field label="CVC">{(id) => <input id={id} inputMode="numeric" className={`${inputClass} font-mono`} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} autoComplete="cc-csc" placeholder="123" />}</Field>
        {test && <p className="text-[11px] text-hr-ink-4 sm:col-span-3">Test booking: use 4242 4242 4242 4242, any future date.</p>}
      </fieldset>

      {error && (
        <p className="flex items-start gap-2 text-[13px] text-hr-alert">
          <Sq className="mt-[6px] bg-hr-alert" /> {error}
        </p>
      )}
      <Button type="submit" disabled={busy || expired} className="h-11 w-full cursor-pointer">
        {expired ? "Price hold ended" : busy ? "Booking with the airline…" : `Pay ${total} & book`} {!busy && !expired && <ArrowBox />}
      </Button>
    </form>
  );
}
