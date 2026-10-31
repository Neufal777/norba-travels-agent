"use client";

import { useEffect, useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { money } from "@/lib/format";
import type { PaymentBlock } from "@/lib/types";
import { ArrowBox, Button } from "../ui/button";
import { es, useChat } from "./chat-context";
import { Field, StepCard, inputClass, useEditable } from "./step-card";

const NOTE = {
  mock: "Mock data: try 4242 4242 4242 4242 — 4000 0000 0000 0002 is declined. Nothing leaves this machine.",
  sandbox: "Sandbox: the airline's test system. Use a test card; nothing is charged and no real ticket is issued.",
  production: "Your card is charged by the airline when you press Pay.",
};

const brandOf = (n: string) => (/^4/.test(n) ? "VISA" : /^(5[1-5]|2[2-7])/.test(n) ? "MASTERCARD" : /^3[47]/.test(n) ? "AMEX" : "CARD");

function useCountdown(until?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return undefined;
  const left = Math.max(0, Date.parse(until) - now);
  return { left, label: `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")}` };
}

/** The card form. The booking starts on Pay — the only place in the app where money moves, and only by a person. */
export function PaymentResult({ block }: { block: PaymentBlock }) {
  const { send, trip } = useChat();
  const editable = useEditable("payment");
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const hold = useCountdown(block.holdUntil);
  const digits = number.replace(/\D/g, "");
  const [mm, yy] = expiry.split("/").map((x) => Number(x));
  const ready = digits.length >= 12 && holder.trim() && mm >= 1 && mm <= 12 && yy >= 0 && expiry.length === 5;
  const expired = hold?.left === 0;
  const total = money(block.amount, block.currency, { cents: true });
  const done = trip.steps.payment.status === "done";

  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || expired) return;
    const card = { number: digits, holder: holder.trim(), expiry_month: mm, expiry_year: 2000 + yy, cvv: cvv || undefined };
    const line = `${brandOf(digits)} •••• ${digits.slice(-4)}`;
    // The card leaves the page once, in this request; the form forgets it straight away.
    setNumber("");
    setCvv("");
    send(es() ? `Pagar ${total} con ${line}` : `Pay ${total} with ${line}`, { kind: "payment", card });
  };

  return (
    <StepCard step="payment" aside={hold && !done && <span className={`font-mono text-[10px] tabular-nums ${expired ? "text-hr-alert" : "text-hr-ink-3"}`}>{expired ? "Price hold ended" : `Held ${hold.label}`}</span>}>
      <form onSubmit={pay} className="grid gap-5 px-4 py-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <fieldset disabled={!editable || expired} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
          <Field label="Card number" className="sm:col-span-3">
            {(id) => (
              <div className="relative">
                <input
                  id={id}
                  className={`${inputClass} pl-9 font-mono tracking-[0.06em]`}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 1234 1234 1234"
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "))}
                />
                <CreditCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-hr-ink-3" />
                {digits.length >= 2 && <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-hr-ink-3">{brandOf(digits)}</span>}
              </div>
            )}
          </Field>
          <Field label="Name on the card">{(id) => <input id={id} className={inputClass} autoComplete="cc-name" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={64} />}</Field>
          <Field label="Expiry">
            {(id) => (
              <input
                id={id}
                className={`${inputClass} font-mono`}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                }}
              />
            )}
          </Field>
          <Field label="CVC">{(id) => <input id={id} className={`${inputClass} font-mono`} inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} />}</Field>
          <p className="text-[12px] leading-snug text-hr-ink-3 sm:col-span-3">{NOTE[block.environment]}</p>
        </fieldset>

        <div className="flex flex-col justify-between gap-4 border-t border-hr-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div>
            <p className="hr-eyebrow text-[10px]">To pay</p>
            <p className="mt-2 text-[26px] leading-none tracking-[-0.03em] tabular-nums text-hr-ink-strong">{total}</p>
          </div>
          <div className="space-y-2">
            <Button type="submit" className="w-full cursor-pointer" disabled={!editable || !ready || expired}>
              {done ? "Paid" : `Pay & book`} <ArrowBox />
            </Button>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-hr-ink-3">
              <Lock className="size-3" /> Card used for this booking only, never stored or shown to the AI.
            </p>
          </div>
        </div>
      </form>
    </StepCard>
  );
}
