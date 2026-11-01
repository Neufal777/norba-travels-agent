import "server-only";

import { money } from "@/lib/format";
import type { Contact, FormSubmission, Offer, Passenger, PaxSlot, PaxType } from "@/lib/types";
import type { CardData } from "../norba/port";
import { step } from "./trip";
import type { ToolContext } from "./tools";

/*
 * What the forms in the chat send. Each is checked against what the trip offered (seats on the served maps,
 * extras on the served list, one entry per traveller slot, a card that can pay) and stored on the session. The
 * model receives a summary note — first names and the card's last four digits at most.
 */

export class FormError extends Error {}

const NAME = /^[\p{L}][\p{L}' -]{0,39}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?\d[\d ]{6,18}$/;

const luhn = (n: string) =>
  n
    .split("")
    .reverse()
    .reduce((a, d, i) => a + (i % 2 ? ((Number(d) * 2) % 10) + Math.floor((Number(d) * 2) / 10) : Number(d)), 0) %
    10 ===
  0;

/** The brand the airline expects beside the number, read from the card's first digits. */
export function cardBrand(n: string) {
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return "MASTERCARD";
  if (/^3[47]/.test(n)) return "AMEX";
  if (/^(6011|65|64[4-9])/.test(n)) return "DISCOVER";
  if (/^3(0[0-5]|[68])/.test(n)) return "DINERS";
  return "CARD";
}

function ageOn(dob: string, day: string) {
  const [y, m, d] = dob.split("-").map(Number);
  const [Y, M, D] = day.slice(0, 10).split("-").map(Number);
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0);
}

const AGE: Record<PaxType, [number, number, string]> = { ADT: [12, 130, "an adult (12 or older)"], CHD: [2, 11, "a child (2 to 11)"], INF: [0, 1, "an infant (under 2)"] };

/** Stores a form's answer on the trip and returns what the model is told. Throws FormError with a short reason. */
export function applyForm(ctx: ToolContext, form: FormSubmission): string {
  const t = ctx.session.trip;
  if (!t.priced) throw new FormError("Choose and price a flight first.");
  if (t.view.steps.booking.status === "done") throw new FormError("This trip is already booked.");
  const cur = t.priced.currency;

  if (form.kind === "seats") {
    if (form.skip || !form.seats?.length) {
      t.seats = [];
      step(ctx, "seats", "skipped", "No seats chosen");
      return "[Seats form] The traveller skipped seat selection. Next: choose_extras.";
    }
    const chosen = [];
    let total = 0;
    const taken = new Set<string>();
    for (const s of form.seats) {
      const m = t.seatMaps.find((x) => x.segment.segment_id === s.segment_id);
      const seat = m?.map.seats.find((x) => x.row === s.row && x.column === s.column);
      if (!m || !seat) throw new FormError(`Seat ${s.row}${s.column} is not on the map.`);
      if (!seat.available) throw new FormError(`Seat ${s.row}${s.column} is taken.`);
      const pax = t.pax.find((p) => p.id === s.passenger_id);
      if (!pax || pax.type === "INF") throw new FormError("Each seat needs a traveller who holds a seat.");
      for (const k of [`${s.segment_id}|${s.row}${s.column}`, `${s.segment_id}|${s.passenger_id}`]) {
        if (taken.has(k)) throw new FormError("One seat per traveller per flight.");
        taken.add(k);
      }
      total += seat.price?.amount ?? 0;
      chosen.push({ segment_id: s.segment_id, row: s.row, column: s.column, passenger_id: s.passenger_id });
    }
    t.seats = chosen;
    const list = chosen.map((s) => `${s.row}${s.column}`).join(", ");
    step(ctx, "seats", "done", `${list}${total ? ` · ${money(total, cur)}` : " · free"}`);
    return `[Seats form] The traveller chose ${chosen.length} seat${chosen.length > 1 ? "s" : ""}: ${list}, ${money(total, cur)} in all. Next: choose_extras.`;
  }

  if (form.kind === "extras") {
    if (form.skip || !form.extras?.length) {
      t.extras = [];
      step(ctx, "extras", "skipped", "No extras");
      return "[Extras form] The traveller wants no extras. Next: ask_traveller_details.";
    }
    let total = 0;
    t.extras = form.extras.map((e) => {
      const svc = t.services.find((x) => x.service_id === e.service_id);
      if (!svc) throw new FormError("That extra is no longer on sale.");
      if (e.passenger_id && !t.pax.some((p) => p.id === e.passenger_id)) throw new FormError("Unknown traveller on an extra.");
      total += svc.price?.amount ?? 0;
      return { ancillary_offer_id: svc.service_id, passenger_id: e.passenger_id, segment_ids: svc.segment_refs };
    });
    const names = [...new Set(form.extras.map((e) => t.services.find((x) => x.service_id === e.service_id)!.name))];
    step(ctx, "extras", "done", `${t.extras.length} extra${t.extras.length > 1 ? "s" : ""} · ${money(total, cur)}`);
    return `[Extras form] The traveller added: ${names.join(", ")} (${t.extras.length} items, ${money(total, cur)}). Next: ask_traveller_details.`;
  }

  if (form.kind === "travellers") {
    const passengers = validPassengers(form.passengers, t.pax, t.priced);
    const contact = validContact(form.contact);
    t.travellers = { passengers, contact };
    // Names do not move the price, but a total already approved is approved again.
    if (t.view.steps.review.status === "done") step(ctx, "review", "pending");
    if (t.view.steps.payment.status !== "pending") step(ctx, "payment", "pending");
    step(ctx, "travellers", "done", passengers.map((p) => `${p.first_name} ${p.last_name[0]}.`).join(", "));
    return `[Travellers form] Details saved for ${passengers.map((p) => `${p.first_name} (${p.type})`).join(", ")}, contact email and phone given. Next: review_price.`;
  }

  if (form.kind === "payment") {
    if (!t.quote || t.view.steps.review.status !== "done") throw new FormError("Review the total before paying.");
    const { card, brand } = validCard(form.card);
    t.payment = { card, amount: t.quote.total, currency: t.quote.currency, last4: card.number.slice(-4), brand, at: Date.now() };
    step(ctx, "payment", "done", `${brand} •••• ${card.number.slice(-4)} · ${money(t.quote.total, t.quote.currency, { cents: true })}`);
    return `[Payment form] The traveller pressed Pay: ${brand} ending ${card.number.slice(-4)} for ${money(t.quote.total, t.quote.currency, { cents: true })}.`;
  }

  throw new FormError("Unknown form.");
}

/** One entry per traveller slot, as on the passport, old enough or young enough for the slot on the day of travel. */
export function validPassengers(input: Passenger[] | undefined, slots: PaxSlot[], offer: Offer): Passenger[] {
  const depart = offer.slices[0].departure_utc;
  const back = offer.slices.at(-1)!.arrival_utc;
  if (!Array.isArray(input) || input.length !== slots.length) throw new FormError(`Details are needed for ${slots.length} traveller${slots.length > 1 ? "s" : ""}.`);
  return input.map((p, i) => {
    const slot = slots[i];
    const first = p.first_name?.trim();
    const last = p.last_name?.trim();
    if (!NAME.test(first ?? "") || !NAME.test(last ?? "")) throw new FormError(`${slot.label}: name and surname as on the passport, letters only.`);
    if (!DATE.test(p.date_of_birth ?? "") || p.date_of_birth > depart.slice(0, 10)) throw new FormError(`${slot.label}: date of birth as YYYY-MM-DD.`);
    const age = ageOn(p.date_of_birth, depart);
    const [min, max, what] = AGE[slot.type];
    if (age < min || age > max) throw new FormError(`${slot.label} must be ${what} on the day of travel.`);
    if (p.gender !== "M" && p.gender !== "F") throw new FormError(`${slot.label}: choose a gender as on the passport.`);
    let document: Passenger["document"];
    if (p.document?.number?.trim()) {
      const d = p.document;
      if (!/^[A-Z0-9]{5,20}$/i.test(d.number.trim())) throw new FormError(`${slot.label}: the document number looks wrong.`);
      if (!/^[A-Z]{2}$/.test(d.issuing_country ?? "") || !/^[A-Z]{2}$/.test(d.nationality ?? "")) throw new FormError(`${slot.label}: country codes as two letters (ES, GB…).`);
      if (!DATE.test(d.expiry_date ?? "") || d.expiry_date <= back.slice(0, 10)) throw new FormError(`${slot.label}: the document must be valid after the trip.`);
      document = { type: d.type === "I" ? "I" : "P", number: d.number.trim().toUpperCase(), issuing_country: d.issuing_country, nationality: d.nationality, expiry_date: d.expiry_date };
    }
    // Airlines file names as on the passport's machine-readable line: "García" is refused, "Garcia" is booked.
    const latin = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return { id: slot.id, type: slot.type, first_name: latin(first!), last_name: latin(last!), date_of_birth: p.date_of_birth, gender: p.gender, document };
  });
}

export function validContact(c: Contact | undefined): Contact {
  const email = c?.email?.trim() ?? "";
  const phone = c?.phone?.replace(/\s+/g, "") ?? "";
  if (!EMAIL.test(email)) throw new FormError("A contact email, please.");
  if (!PHONE.test(phone)) throw new FormError("A contact phone with country code, e.g. +34 600 000 000.");
  return { email, phone };
}

/** A card that can pay: a valid number, a name, a future expiry. Returned with its brand for the airline. */
export function validCard(c: { number: string; holder: string; expiry_month: number; expiry_year: number; cvv?: string } | undefined): { card: CardData; brand: string } {
  const number = (c?.number ?? "").replace(/\D/g, "");
  if (number.length < 12 || number.length > 19 || !luhn(number)) throw new FormError("That card number is not valid.");
  if (!c!.holder?.trim() || c!.holder.trim().length > 64) throw new FormError("The name on the card, please.");
  const now = new Date();
  const y = c!.expiry_year < 100 ? 2000 + c!.expiry_year : c!.expiry_year;
  if (!(c!.expiry_month >= 1 && c!.expiry_month <= 12) || y < now.getFullYear() || (y === now.getFullYear() && c!.expiry_month < now.getMonth() + 1) || y > now.getFullYear() + 20)
    throw new FormError("The card has expired or the date is wrong.");
  if (c!.cvv && !/^\d{3,4}$/.test(c!.cvv)) throw new FormError("The security code has 3 or 4 digits.");
  const brand = cardBrand(number);
  return { card: { number, holder: c!.holder.trim(), expiry_month: c!.expiry_month, expiry_year: y, cvv: c!.cvv || undefined, brand: brand === "CARD" ? undefined : brand }, brand };
}
