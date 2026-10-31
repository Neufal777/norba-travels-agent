import "server-only";

import { duration, money } from "@/lib/format";
import { groupItineraries, sortItineraries } from "@/lib/offers";
import type { CabinClass } from "@/lib/types";
import { norba } from "../norba";
import type { Turn } from "./run";
import { callTool } from "./steps";
import { placeProse } from "./places";
import { lastSearch, type Draft, type Session } from "./sessions";
import type { ToolContext } from "./tools";

/*
 * The offline planner: what answers while there is no MODEL_API_KEY. It reads Spanish and English requests with
 * rules — places, dates, travellers, cabin, follow-up filters — and drives the very same tools the model would, so
 * the chat, the cards and the Norba calls are the real ones. Muse Spark replaces all of this the moment a key is set.
 */

type Lang = "es" | "en";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function langOf(text: string, fallback: Lang): Lang {
  const t = ` ${fold(text)} `;
  const es = (t.match(/ (quiero|vuelo|vuelos|de|desde|para|ida|vuelta|manana|semana|personas|adultos|ninos|con|sin|el|la|los|las|y|por|barato|directo|hola|busca|buscame|necesito|viaje|dias|noches) /g) ?? []).length;
  const en = (t.match(/ (want|flight|flights|from|to|for|return|tomorrow|week|people|adults|kids|with|without|the|and|cheap|direct|hi|hello|find|need|trip|days|nights|on) /g) ?? []).length;
  return es === en ? fallback : es > en ? "es" : "en";
}

// ── dates ─────────────────────────────────────────────────────────────────────

const MONTHS: [RegExp, number][] = [
  [/^(ene|enero|jan|january)/, 1],
  [/^(feb|febrero|february)/, 2],
  [/^(mar|marzo|march)/, 3],
  [/^(abr|abril|apr|april)/, 4],
  [/^(may|mayo)/, 5],
  [/^(jun|junio|june)/, 6],
  [/^(jul|julio|july)/, 7],
  [/^(ago|agosto|aug|august)/, 8],
  [/^(sep|sept|septiembre|setiembre|september)/, 9],
  [/^(oct|octubre|october)/, 10],
  [/^(nov|noviembre|november)/, 11],
  [/^(dic|diciembre|dec|december)/, 12],
];
const WEEKDAYS: [RegExp, number][] = [
  [/^(domingo|sunday|sun)$/, 0],
  [/^(lunes|monday|mon)$/, 1],
  [/^(martes|tuesday|tue)$/, 2],
  [/^(miercoles|wednesday|wed)$/, 3],
  [/^(jueves|thursday|thu)$/, 4],
  [/^(viernes|friday|fri)$/, 5],
  [/^(sabado|saturday|sat)$/, 6],
];
const NUMBERS: Record<string, number> = { un: 1, uno: 1, una: 1, one: 1, a: 1, dos: 2, two: 2, tres: 3, three: 3, cuatro: 4, four: 4, cinco: 5, five: 5, seis: 6, six: 6, siete: 7, seven: 7, ocho: 8, eight: 8, nueve: 9, nine: 9, diez: 10, ten: 10, catorce: 14, fourteen: 14, quince: 15, fifteen: 15 };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, n: number) => iso(new Date(Date.parse(`${isoDate}T12:00:00Z`) + n * 86_400_000));
const monthOf = (word: string) => MONTHS.find(([re]) => re.test(word))?.[1];
const num = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUMBERS[w]);

/** A day and month, rolled into next year when it has passed. */
function dayMonth(day: number, month: number, today: string, year?: number) {
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  const y = year ?? Number(today.slice(0, 4));
  let d = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!year && d < today) d = `${y + 1}${d.slice(4)}`;
  return d;
}

/** The next such weekday after today. */
function nextWeekday(today: string, wd: number) {
  const cur = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, (wd - cur + 7) % 7 || 7);
}

/** Every date the text names, in order of appearance. */
function findDates(text: string, today: string): string[] {
  const t = fold(text);
  const found: { at: number; date: string; weekday?: boolean }[] = [];
  const push = (at: number, date?: string, weekday = false) => date && !found.some((f) => f.at === at) && found.push({ at, date, weekday });

  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(m.index!, `${m[1]}-${m[2]}-${m[3]}`);
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
    push(m.index!, dayMonth(Number(m[1]), Number(m[2]), today, y));
  }
  // "15 de diciembre", "15 dic", "15th of december", "15 december 2026"
  for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:de\s+|of\s+)?([a-z]{3,10})(?:\s+(?:de\s+)?(\d{4}))?/g)) {
    const mo = monthOf(m[2]);
    if (mo) push(m.index!, dayMonth(Number(m[1]), mo, today, m[3] ? Number(m[3]) : undefined));
  }
  // "december 15", "dec 15th"
  for (const m of t.matchAll(/\b([a-z]{3,10})\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/g)) {
    const mo = monthOf(m[1]);
    if (mo) push(m.index!, dayMonth(Number(m[2]), mo, today, m[3] ? Number(m[3]) : undefined));
  }
  for (const m of t.matchAll(/\b(pasado manana|day after tomorrow)\b/g)) push(m.index!, addDays(today, 2));
  for (const m of t.matchAll(/\b(manana|tomorrow)\b/g)) {
    // "por la mañana" is the morning, not tomorrow.
    if (!/(por|de|en) la $/.test(t.slice(Math.max(0, m.index! - 7), m.index!))) push(m.index!, addDays(today, 1));
  }
  for (const m of t.matchAll(/\b(hoy|today)\b/g)) push(m.index!, today);
  for (const m of t.matchAll(/\b(?:el\s+)?(?:(proximo|next|este|this)\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?:\s+(que viene|proximo))?/g)) {
    const wd = WEEKDAYS.find(([re]) => re.test(m[2]))?.[1];
    if (wd != null) push(m.index!, nextWeekday(today, wd), true);
  }
  for (const m of t.matchAll(/\b(?:este\s+|this\s+|next\s+|el proximo\s+)?(fin de semana|finde|weekend)\b/g)) {
    const fri = nextWeekday(today, 5);
    push(m.index!, fri);
    push(m.index! + 1, addDays(fri, 2));
  }
  for (const m of t.matchAll(/\b(?:en|in)\s+(\w+)\s+(semanas?|weeks?|dias|days)\b/g)) {
    const n = num(m[1]);
    if (n) push(m.index!, addDays(today, /seman|week/.test(m[2]) ? n * 7 : n));
  }
  // "en marzo", "in march": the first of the month, or today if it is this month.
  if (!found.length)
    for (const m of t.matchAll(/\b(?:en|in|para|for)\s+([a-z]{3,10})\b/g)) {
      const mo = monthOf(m[1]);
      if (mo && m[1].length >= 4) {
        const first = dayMonth(1, mo, today);
        push(m.index!, first && first.slice(0, 7) === today.slice(0, 7) ? today : first);
      }
    }
  found.sort((a, b) => a.at - b.at);
  // "Friday … back on Sunday": a weekday after another date is the first such day after it.
  for (let i = 1; i < found.length; i++)
    if (found[i].weekday) while (found[i].date <= found[i - 1].date) found[i].date = addDays(found[i].date, 7);
  return found.map((f) => f.date);
}

/** "for 5 days", "una semana", "3 noches": the length of a round trip — not "en dos semanas", which is a date. */
function stayLength(text: string): number | undefined {
  for (const m of fold(text).matchAll(/(?:^|\b(\w+)\s+)(\w+)\s+(dias|days|noches|nights|semanas?|weeks?)\b/g)) {
    if (m[1] && /^(en|in|dentro|within)$/.test(m[1])) continue;
    const n = num(m[2]);
    if (n) return /seman|week/.test(m[3]) ? n * 7 : n;
  }
  return undefined;
}

// ── travellers, cabin, places ─────────────────────────────────────────────────

function travellers(text: string): Partial<Draft> {
  const t = fold(text);
  const out: Partial<Draft> = {};
  const count = (re: RegExp) => {
    const m = t.match(re);
    return m ? num(m[1]) : undefined;
  };
  const adults = count(/\b(\w+)\s+(adultos?|adults?|personas|people|persons|pasajeros|passengers|pax|viajeros|travell?ers)\b/);
  if (adults) out.adults = adults;
  else if (/\b(para dos|for two|con mi (pareja|novi[oa]|mujer|marido|espos[oa])|with my (partner|wife|husband|girlfriend|boyfriend)|we are two|somos dos)\b/.test(t)) out.adults = 2;
  const kids = count(/\b(\w+)\s+(ninos?|ninas?|hij[oa]s?|kids?|children|child)\b/);
  if (kids) out.children = kids;
  const babies = count(/\b(\w+)\s+(bebes?|babies|baby|infants?)\b/);
  if (babies) out.infants = babies;
  else if (/\b(un bebe|a baby|an infant)\b/.test(t)) out.infants = 1;
  return out;
}

function cabinOf(text: string): CabinClass | undefined {
  const t = fold(text);
  if (/\b(primera|first class)\b/.test(t)) return "first";
  if (/\b(business|ejecutiva|negocios|preferente)\b/.test(t)) return "business";
  if (/\b(premium)\b/.test(t)) return "premium_economy";
  if (/\b(turista|economy|economica)\b/.test(t)) return "economy";
  return undefined;
}

const STOP_WORDS =
  /\s+(?:el|la|los|on|the|this|next|este|esta|proximo|in|en|del|de ida|ida|y vuelta|ida y vuelta|round|return|returning|vuelta|regreso|volviendo|with|con|para|for|por|durante|sin|without|non|direct|directo|solo|only|manana|tomorrow|hoy|today|pasado|a partir|after|antes|before|economy|business|turista|\d).*$/;

/**
 * The origin and destination phrases: "de Madrid a Atenas", "from London to NYC", "MAD - JFK", "Madrid → Roma".
 * `strong` when the wording can only be a route; "Madrid a Atenas" is weak, as "baratos a la mañana" reads alike.
 */
function placePhrases(text: string): { from?: string; to?: string; strong?: boolean } {
  const raw = text.replace(/[¿?¡!.]/g, " ").replace(/\s+/g, " ").trim();
  const codes = raw.match(/\b[A-Z]{3}\b/g);
  if (codes && codes.length >= 2) return { from: codes[0], to: codes[1], strong: true };
  const t = fold(raw);
  const clean = (s?: string) => s?.replace(STOP_WORDS, "").replace(/^(el|la|los|las|the)\s+/, "").trim() || undefined;
  const strong = t.match(/\b(?:desde|from|de|saliendo de|leaving)\s+([a-z .'-]+?)\s+(?:a|to|hasta|hacia|para|→|->|-)\s+([a-z .'-]+)/);
  if (strong) return { from: clean(strong[1]), to: clean(strong[2]), strong: true };
  const arrow = t.match(/([a-z .'-]+?)\s*(?:→|->|\s-\s)\s*([a-z .'-]+)/);
  if (arrow) return { from: clean(arrow[1]), to: clean(arrow[2]), strong: true };
  const goTo = t.match(/\b(?:volar|viajar|ir|irme|escaparme|fly|go|travel|get)\s+(?:a|to|hacia)\s+([a-z .'-]+)/);
  if (goTo && !/\b(desde|from)\b/.test(t)) return { to: clean(goTo[1]) };
  const m = t.match(/^(?:vuelos?\s+|flights?\s+|busca(?:me)?\s+(?:vuelos?\s+)?|quiero\s+(?:ir\s+)?|find\s+(?:me\s+)?(?:flights?\s+)?)?([a-z .']+?)\s+(?:to|a)\s+([a-z .']+)/);
  if (m) return { from: clean(m[1]), to: clean(m[2]) };
  const toOnly = t.match(/\b(?:a|to|hacia|para ir a|ir a|viajar a|volar a|fly to|go to|trip to)\s+([a-z .'-]+)/);
  if (toOnly) return { to: clean(toOnly[1]) };
  const fromOnly = t.match(/\b(?:desde|from|salgo de|saliendo de)\s+([a-z .'-]+)/);
  if (fromOnly) return { from: clean(fromOnly[1]) };
  return {};
}

async function resolvePlace(phrase: string): Promise<string | undefined> {
  if (/^[A-Z]{3}$/.test(phrase)) return phrase;
  const found = await norba().airports(phrase);
  // A metropolitan code searches every airport of the city, the usual intent when only the city is named.
  return (found.find((a) => a.airport_type === "metropolitan_area") ?? found[0])?.iata_code;
}

// ── talking ───────────────────────────────────────────────────────────────────

async function say(ctx: ToolContext, text: string) {
  // Words arrive one by one, as a model's would.
  for (const word of text.split(/(?<=\s)/)) {
    ctx.emit({ type: "text", delta: word });
    await new Promise((r) => setTimeout(r, 14));
  }
}

const L = {
  es: {
    askOrigin: "¿Desde qué ciudad sales?",
    askDestination: "¿A dónde quieres volar?",
    askDate: (dest: string) => `¿Qué día quieres salir hacia ${dest}?`,
    askReturn: "¿Y qué día vuelves?",
    unknownPlace: (p: string) => `No encuentro “${p}” como aeropuerto o ciudad. ¿Puedes escribirlo de otra forma o darme el código IATA (Asociación Internacional de Transporte Aéreo)?`,
    none: "Ninguna aerolínea ha devuelto vuelos para esta búsqueda. ¿Pruebo otra fecha o un aeropuerto cercano?",
    failed: "La búsqueda no ha salido bien: ",
    found: (its: number) => `**${its} opciones.**`,
    cheapest: (ref: string, price: string) => `La más barata, ${ref}, por **${price}**`,
    fastest: (ref: string, time: string) => `la más rápida, ${ref}, en ${time}`,
    next: "Pulsa “Book this” o dime cómo filtrar.",
    refined: (n: number, f: string) => `Quedan **${n} ${n === 1 ? "itinerario" : "itinerarios"}** (${f}).`,
    refinedNext: "¿Algo más? Puedo confirmar el precio de cualquiera o quitar los filtros.",
    cleared: (n: number) => `Sin filtros: vuelven a estar los **${n} itinerarios**.`,
    refinedNone: (f: string) => `Ningún vuelo de la búsqueda cumple: ${f}. ¿Quito algún filtro?`,
    priced: (ref: string, amount: string, was?: string) => `${ref} confirmado: **${amount}**${was ? ` (antes ${was})` : ""}.`,
    seats: "Elige asientos o sáltatelo.",
    noSeats: "Asientos en el check-in.",
    extras: "¿Maletas o extras?",
    noExtras: "Sin extras a la venta.",
    travellers: "Datos de los viajeros, como en el pasaporte.",
    pay: "Nada se cobra hasta que pulses Pagar.",
    booked: (pnr: string) => `¡Reservado! Localizador **${pnr}**.`,
    bookedSandbox: "Reserva de pruebas: no se ha cobrado nada.",
    bookFailed: (why: string) => `La reserva no se ha completado: ${why}`,
    unknownOutcome: "La aerolínea no ha respondido y la tarjeta podría haberse cargado. **No vuelvas a pagar**: contacta con soporte.",
    skip: /\b(sin asientos|no quiero asientos|sin extras|no quiero extras|nada|ninguno|salta|saltar|omitir|no gracias)\b/,
    unknownRef: (ref: string) => `No tengo ninguna oferta ${ref} en esta conversación.`,
    help: "Dime a dónde quieres volar y cuándo, por ejemplo: “Madrid a Atenas el 12 de diciembre, 2 adultos”.",
    replies: { nonstop: "Solo directos", morning: "Salir por la mañana", bag: "Con maleta facturada", cheapest: "Ordena por precio" },
  },
  en: {
    askOrigin: "Which city are you leaving from?",
    askDestination: "Where would you like to fly?",
    askDate: (dest: string) => `Which day do you want to fly to ${dest}?`,
    askReturn: "And when do you come back?",
    unknownPlace: (p: string) => `I can't find “${p}” as an airport or city. Could you spell it differently or give me the IATA (International Air Transport Association) code?`,
    none: "No airline returned flights for this search. Shall I try another date or a nearby airport?",
    failed: "The search didn't go through: ",
    found: (its: number) => `**${its} options.**`,
    cheapest: (ref: string, price: string) => `Cheapest is ${ref} at **${price}**`,
    fastest: (ref: string, time: string) => `fastest is ${ref} in ${time}`,
    next: "Press “Book this” or tell me how to filter.",
    refined: (n: number, f: string) => `**${n} ${n === 1 ? "itinerary" : "itineraries"}** left (${f}).`,
    refinedNext: "Anything else? I can confirm any price or clear the filters.",
    cleared: (n: number) => `Filters cleared: all **${n} itineraries** are back.`,
    refinedNone: (f: string) => `Nothing in the search matches: ${f}. Shall I drop a filter?`,
    priced: (ref: string, amount: string, was?: string) => `${ref} confirmed: **${amount}**${was ? ` (was ${was})` : ""}.`,
    seats: "Pick seats, or skip.",
    noSeats: "Seats are given at check-in.",
    extras: "Bags or extras?",
    noExtras: "No extras on sale.",
    travellers: "Travellers' details, as on the passport.",
    pay: "Nothing is charged until you press Pay.",
    booked: (pnr: string) => `Booked! Reference **${pnr}**.`,
    bookedSandbox: "Sandbox booking: nothing was charged.",
    bookFailed: (why: string) => `The booking did not go through: ${why}`,
    unknownOutcome: "The airline did not answer and the card may have been charged. **Do not pay again**: contact support.",
    skip: /\b(no seats|skip|no extras|none|no thanks|nothing)\b/,
    unknownRef: (ref: string) => `There is no offer ${ref} in this conversation.`,
    help: "Tell me where and when you want to fly, e.g. “London to Athens on 12 December, 2 adults”.",
    replies: { nonstop: "Only non-stop", morning: "Morning departures", bag: "With a checked bag", cheapest: "Sort by price" },
  },
};

async function summarise(session: Session, lang: Lang, ctx: ToolContext, narrowed?: string) {
  const last = lastSearch(session)!;
  const l = L[lang];
  const its = groupItineraries(last.offers);
  const cheapest = sortItineraries(its, "cheapest")[0].cheapest;
  const fastest = sortItineraries(its, "fastest")[0].cheapest;
  const best = sortItineraries(its, "best")[0].cheapest;
  // The cards carry the details: the text names the two that matter and gets out of the way.
  let picks = l.cheapest(last.refs[cheapest.offer_id], money(cheapest.total_amount, cheapest.currency));
  if (fastest !== cheapest) picks += `, ${l.fastest(last.refs[fastest.offer_id], duration(fastest.slices[0].duration_minutes))}`;
  const lines = [`${l.found(its.length)} ${picks}.`];
  if (narrowed) lines.push(narrowed);
  lines.push(l.next);
  await say(ctx, lines.join("\n\n"));
  await callTool("suggest_replies", { options: [l.replies.nonstop, l.replies.morning, l.replies.bag, `${lang === "es" ? "Reservar" : "Book"} ${last.refs[best.offer_id]}`] }, ctx);
}

// ── follow-ups on a search ────────────────────────────────────────────────────

function refineArgs(text: string): Record<string, unknown> | undefined {
  const t = fold(text);
  if (/\b(quita(r)? (los )?filtros|sin filtros|todos los vuelos|clear (the )?filters|show (me )?all|reset)\b/.test(t)) return { clear: true };
  const a: Record<string, unknown> = {};
  if (/\b(directos?|sin escalas|non-?stops?|direct|nonstop)\b/.test(t)) a.max_stops = 0;
  if (/\b(una escala|one stop|1 stop|max(imo)? 1)\b/.test(t)) a.max_stops = 1;
  if (/\b(por la manana|de manana|morning|temprano|early)\b/.test(t)) a.depart_before = "12:00";
  if (/\b(por la tarde|afternoon)\b/.test(t)) Object.assign(a, { depart_after: "12:00", depart_before: "19:00" });
  if (/\b(por la noche|de noche|evening|night)\b/.test(t)) a.depart_after = "18:00";
  const after = t.match(/\b(?:despues de las?|a partir de las?|after|later than)\s+(\d{1,2})(?::(\d{2}))?/);
  if (after) a.depart_after = `${after[1].padStart(2, "0")}:${after[2] ?? "00"}`;
  const before = t.match(/\b(?:antes de las?|before|earlier than)\s+(\d{1,2})(?::(\d{2}))?/);
  if (before) a.depart_before = `${before[1].padStart(2, "0")}:${before[2] ?? "00"}`;
  if (/\b(maletas?|equipaje|facturad[ao]|checked bags?|luggage|baggage|with (a )?bag)\b/.test(t)) a.checked_bag = true;
  if (/\b(reembolsables?|refundable)\b/.test(t)) a.refundable = true;
  const price = t.match(/\b(?:menos de|por debajo de|under|below|max(?:imo)?|hasta|up to)\s+(\d{2,5})/);
  if (price) a.max_price = Number(price[1]);
  const airlines = [
    [/aegean/, "A3"],
    [/olympic/, "OA"],
    [/american/, "AA"],
    [/air france/, "AF"],
    [/klm/, "KL"],
  ].filter(([re]) => (re as RegExp).test(t)).map(([, c]) => c);
  if (airlines.length) a.airlines = airlines;
  if (/\b(barat[oa]s?|cheap(est|er)?|precio|price)\b/.test(t) && !a.max_price) a.sort = "cheapest";
  if (/\b(rapid[oa]s?|fast(est)?|corto|quick(est)?|short(est)?)\b/.test(t)) a.sort = "fastest";
  if (/\b(temprano|earliest|primero)\b/.test(t)) a.sort = "earliest";
  return Object.keys(a).length ? a : undefined;
}

// ── the turn ──────────────────────────────────────────────────────────────────

const clean = (content: string) => content.replace(/^ERROR[^:]*:\s*/, "");

/**
 * After the price check, one step at a time: seats, extras, travellers, review, payment. A step the airline has
 * nothing for skips itself, and the next one opens in the same turn.
 */
async function advance(ctx: ToolContext, lang: Lang, lead: string[] = []) {
  const l = L[lang];
  const steps = ctx.session.trip.view.steps;
  const lines = [...lead];
  const settled = (id: keyof typeof steps) => steps[id].status === "done" || steps[id].status === "skipped";
  if (!settled("seats")) {
    const out = await callTool("choose_seats", {}, ctx);
    if (out.content.startsWith("ERROR")) return say(ctx, [...lines, `${l.failed}${clean(out.content)}`].join("\n\n"));
    if (steps.seats.status === "waiting") return say(ctx, [...lines, l.seats].join("\n\n"));
    lines.push(l.noSeats);
  }
  if (!settled("extras")) {
    const out = await callTool("choose_extras", {}, ctx);
    if (out.content.startsWith("ERROR")) return say(ctx, [...lines, `${l.failed}${clean(out.content)}`].join("\n\n"));
    if (steps.extras.status === "waiting") return say(ctx, [...lines, l.extras].join("\n\n"));
    lines.push(l.noExtras);
  }
  if (steps.travellers.status !== "done") {
    await callTool("ask_traveller_details", {}, ctx);
    return say(ctx, [...lines, l.travellers].join("\n\n"));
  }
  if (steps.review.status !== "done") {
    // The review card shows the total: the text only says what comes next.
    const out = await callTool("review_price", {}, ctx);
    if (out.content.startsWith("ERROR")) return say(ctx, [...lines, `${l.failed}${clean(out.content)}`].join("\n\n"));
  }
  const out = await callTool("ask_payment", {}, ctx);
  if (out.content.startsWith("ERROR")) return say(ctx, [...lines, `${l.failed}${clean(out.content)}`].join("\n\n"));
  return say(ctx, [...lines, l.pay].join("\n\n"));
}

export async function runOffline(turn: Turn) {
  const { session, text, context, emit, signal } = turn;
  const ctx: ToolContext = { session, emit, signal };
  const today = /^\d{4}-\d{2}-\d{2}$/.test(context.today ?? "") ? context.today! : iso(new Date());
  const lang = turn.form ? (session.lang ?? (context.locale?.startsWith("es") ? "es" : "en")) : langOf(text, session.lang ?? (context.locale?.startsWith("es") ? "es" : "en"));
  session.lang = lang;
  const l = L[lang];
  const t = fold(text);
  const trip = session.trip;

  // A form answered in the chat moves the booking on.
  if (turn.form) {
    if (turn.form.kind !== "payment") return advance(ctx, lang);
    const b = turn.booking!;
    const order = trip.order;
    if (order && !b.content.startsWith("ERROR")) {
      const lines = [l.booked(order.pnr ?? order.order_id)];
      if (/outcome_unknown|may have been charged/.test(b.content)) lines.push(l.unknownOutcome);
      if (order.environment === "sandbox") lines.push(l.bookedSandbox);
      return say(ctx, lines.join("\n\n"));
    }
    // The tool's hint after " — " is for a model; the traveller reads the airline's own words.
    return say(ctx, /outcome_unknown|did not answer|No answer/.test(b.content) ? l.unknownOutcome : l.bookFailed(clean(b.content).split(" — ")[0]));
  }

  // "sin asientos", "skip": the step the trip waits on is skipped.
  const waitingOn = (["seats", "extras"] as const).find((id) => trip.view.steps[id].status === "waiting");
  if (waitingOn && l.skip.test(t)) {
    await callTool("skip_step", { step: waitingOn }, ctx);
    return advance(ctx, lang);
  }

  // "confirma o3", "price o3", "book o3"
  const priceRef = t.match(/\b(o\d{1,4})\b/);
  if (priceRef && /\b(confirm|confirma|precio|price|reserv|book|quiero|i want|take|elijo|me quedo)/.test(t)) {
    const ref = priceRef[1];
    if (!session.offers.has(ref)) return say(ctx, l.unknownRef(ref));
    const out = await callTool("price_offer", { ref }, ctx);
    if (out.content.startsWith("ERROR")) return say(ctx, `${l.failed}${clean(out.content)}`);
    const before = session.offers.get(ref)!;
    const p = trip.priced!;
    const was = Math.abs(p.total_amount - before.total_amount) >= 0.01 ? money(before.total_amount, before.currency, { cents: true }) : undefined;
    return advance(ctx, lang, [l.priced(ref, money(p.total_amount, p.currency, { cents: true }), was)]);
  }

  const draft = session.draft;
  const places = placePhrases(text);
  // An answer to "when do you come back?" counts its weekdays from the departure.
  const dates = findDates(text, draft.awaiting === "return_date" && draft.departure_date ? draft.departure_date : today);
  const people = travellers(text);
  const cabin = cabinOf(text);
  // A follow-up on the results ("solo directos", "only non-stop") unless the message clearly starts another search.
  const followUp = lastSearch(session) && !draft.awaiting ? refineArgs(text) : undefined;
  const startsNewSearch = Boolean(dates.length || places.strong || ((places.from || places.to) && !followUp));
  const refine = startsNewSearch ? undefined : followUp;
  if (!startsNewSearch) {
    places.from = undefined;
    places.to = undefined;
  }
  if (refine) {
    session.filters = refine.clear ? {} : { ...session.filters, ...refine };
    const out = await callTool("refine_results", session.filters, ctx);
    const filter = out.content.match(/^Filter: (.*)$/m)?.[1] ?? "";
    if (out.content.startsWith("ERROR")) return say(ctx, `${l.failed}${out.content}`);
    const none = out.content.match(/^Nothing in the last search matches: (.*?)\. \d+ offers/);
    if (none) return say(ctx, l.refinedNone(none[1]));
    const n = Number(out.detail?.match(/\d+/)?.[0] ?? 0);
    return say(ctx, refine.clear ? l.cleared(n) : `${l.refined(n, filter)} ${l.refinedNext}`);
  }

  // Fill the draft: whatever this message adds, plus the answer to the question asked last.
  if (draft.awaiting && !places.from && !places.to && !dates.length) {
    const phrase = text.replace(/[¿?¡!.]/g, "").trim();
    if (draft.awaiting === "origin") places.from = phrase;
    if (draft.awaiting === "destination") places.to = phrase;
  }
  if (startsNewSearch && places.to && !draft.awaiting && lastSearch(session)) {
    // A new route starts over, keeping the travellers.
    session.draft = { adults: draft.adults, children: draft.children, infants: draft.infants };
  }
  const d = session.draft;
  Object.assign(d, people);
  if (cabin) d.cabin_class = cabin;
  if (/\b(directos?|sin escalas|non-?stop|direct)\b/.test(t)) d.max_stops = 0;
  if (/\b(solo ida|one ?way)\b/.test(t)) {
    d.roundTrip = false;
    d.return_date = undefined;
  } else if (/\b(ida y vuelta|round ?trip|return flight|vuelta|regreso|return|volver|back)\b/.test(t)) d.roundTrip = true;

  for (const [slot, phrase] of [
    ["origin", places.from],
    ["destination", places.to],
  ] as const) {
    if (!phrase) continue;
    const step = await callTool("find_airports", { query: phrase }, ctx);
    const code = step.content.startsWith("ERROR") || step.content.startsWith("No airport") ? undefined : await resolvePlace(phrase);
    if (!code) {
      d.awaiting = slot;
      return say(ctx, l.unknownPlace(phrase));
    }
    d[slot] = code;
  }

  if (dates.length) {
    if (d.awaiting === "return_date" && d.departure_date) d.return_date = dates[0];
    else {
      d.departure_date = dates[0];
      if (dates[1]) d.return_date = dates[1];
      else if (d.return_date && d.return_date < d.departure_date) d.return_date = undefined;
    }
  }
  const stay = stayLength(text);
  if (stay && d.departure_date && !d.return_date) d.return_date = addDays(d.departure_date, stay);
  if (d.return_date) d.roundTrip = true;

  if (!d.destination) {
    d.awaiting = "destination";
    await say(ctx, d.origin ? l.askDestination : t.length < 4 ? l.help : l.askDestination);
    return callTool("suggest_replies", { options: lang === "es" ? ["Atenas", "Nueva York", "Londres", "Santorini"] : ["Athens", "New York", "London", "Santorini"] }, ctx);
  }
  if (!d.origin) {
    d.awaiting = "origin";
    await say(ctx, l.askOrigin);
    return callTool("suggest_replies", { options: ["Madrid", "Barcelona", lang === "es" ? "Londres" : "London", "Paris"] }, ctx);
  }
  if (!d.departure_date) {
    d.awaiting = "departure_date";
    await say(ctx, l.askDate(placeProse(session, d.destination)));
    return callTool(
      "suggest_replies",
      { options: lang === "es" ? ["Este fin de semana", "El próximo viernes", "En dos semanas", "Mañana"] : ["This weekend", "Next Friday", "In two weeks", "Tomorrow"] },
      ctx,
    );
  }
  if (d.roundTrip && !d.return_date) {
    d.awaiting = "return_date";
    await say(ctx, l.askReturn);
    return callTool("suggest_replies", { options: lang === "es" ? ["Una semana después", "El domingo", "Solo ida"] : ["A week later", "On Sunday", "One way only"] }, ctx);
  }
  d.awaiting = undefined;
  session.filters = {};
  const out = await callTool(
    "search_flights",
    {
      origin: d.origin,
      destination: d.destination,
      departure_date: d.departure_date,
      return_date: d.return_date,
      adults: d.adults ?? 1,
      children: d.children,
      infants: d.infants,
      cabin_class: d.cabin_class,
      max_stops: d.max_stops,
    },
    ctx,
  );
  if (out.content.startsWith("ERROR")) return say(ctx, `${l.failed}${out.content.replace(/^ERROR[^:]*:\s*/, "")}`);
  if (/no airline returned offers/.test(out.content)) return say(ctx, l.none);
  // Wishes that came with the request ("con maleta", "por la mañana") narrow the fresh results straight away.
  const wishes = refineArgs(text);
  let narrowed: string | undefined;
  if (wishes && Object.keys(wishes).some((k) => k !== "sort" && k !== "max_stops")) {
    session.filters = wishes;
    const out = await callTool("refine_results", wishes, ctx);
    const filter = out.content.match(/^Filter: (.*)$/m)?.[1];
    if (filter) narrowed = l.refined(Number(out.detail?.match(/\d+/)?.[0] ?? 0), filter);
  }
  return summarise(session, lang, ctx, narrowed);
}
