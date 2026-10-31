import "server-only";

import type { AgentEvent, Offer, OffersBlock, Order, SearchRequest } from "@/lib/types";
import type { StoredGroup } from "./group";
import type { ChatTurn } from "../llm/types";
import type { StoredRebook } from "./servicing-tools";
import { newTrip, type TripState } from "./trip";

/** A search the agent ran, kept so follow-ups ("only non-stop", "price o3") never search again. */
export type StoredSearch = { blockId: string; request: SearchRequest; offers: Offer[]; refs: Record<string, string>; at: number };

/** What the offline planner has gathered toward a search across turns, and the slot it asked for last. */
export type Draft = Partial<SearchRequest> & { awaiting?: "origin" | "destination" | "departure_date" | "return_date"; roundTrip?: boolean };

export type Session = {
  id: string;
  /** The model's transcript: system prompt excluded, tool calls and results included. */
  turns: ChatTurn[];
  searches: StoredSearch[];
  /** ref (o1, o2…) → offer, across every search of the conversation. */
  offers: Map<string, Offer>;
  nextRef: number;
  draft: Draft;
  /** The offline planner's reply language, kept for messages too short to tell ("OK", "o3"). */
  lang?: "es" | "en";
  /** The offline planner's filters on the latest search, which add up across follow-ups. */
  filters?: Record<string, unknown>;
  trip: TripState;
  /** IATA code → the name shown beside it ("Madrid", "London Heathrow"), for every code met in this conversation. */
  places: Map<string, string>;
  /** Every order booked or changed in this conversation, the airline's latest answer for each. */
  orders: Order[];
  /** Rebooking alternatives shown, by block id. */
  rebooks: Map<string, StoredRebook>;
  /** The booked flight a board photo or an airline notice says is disrupted. */
  disruption?: { orderId: string; sliceIndex: number };
  /** Group trips planned, by block id. */
  groups: Map<string, StoredGroup>;
  /**
   * What happened while no message was being answered (a friend paid their link, an airline moved a flight): the
   * chat polls for it. Numbered so a poll asks only for what it has not seen.
   */
  outbox: { seq: number; event: AgentEvent }[];
  seq: number;
  touched: number;
  busy: boolean;
};

const TTL_MS = 3 * 60 * 60_000;
const MAX_SESSIONS = 500;

// One process, in memory: enough for a demo; a deployment with several instances would move this to Redis. Kept on
// globalThis because Next.js may load this module once for API routes and again for pages.
const store = globalThis as unknown as { __naSessions?: Map<string, Session> };
const sessions = (store.__naSessions ??= new Map<string, Session>());

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.touched > TTL_MS) sessions.delete(id);
  while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
}

export function session(id?: string): Session {
  sweep();
  const found = id ? sessions.get(id) : undefined;
  if (found) {
    found.touched = Date.now();
    return found;
  }
  const s: Session = { id: id && /^[\w-]{8,64}$/.test(id) ? id : crypto.randomUUID(), turns: [], searches: [], offers: new Map(), nextRef: 1, draft: { adults: 1 }, trip: newTrip(), places: new Map(), orders: [], rebooks: new Map(), groups: new Map(), outbox: [], seq: 0, touched: Date.now(), busy: false };
  sessions.set(s.id, s);
  return s;
}

/** Queues an event for the chat's next poll; the newest 200 are kept. */
export function pushUpdate(s: Session, event: AgentEvent) {
  s.outbox.push({ seq: ++s.seq, event });
  if (s.outbox.length > 200) s.outbox.splice(0, s.outbox.length - 200);
}

/** A conversation that already exists, without creating one: for pages that only read it. */
export function peek(id: string | undefined) {
  return id ? sessions.get(id) : undefined;
}

/** Gives every offer of a search a short ref the model and the traveller can say. */
export function remember(s: Session, block: OffersBlock): StoredSearch {
  const refs: Record<string, string> = {};
  for (const o of block.offers) {
    const ref = `o${s.nextRef++}`;
    refs[o.offer_id] = ref;
    s.offers.set(ref, o);
  }
  const stored = { blockId: block.id, request: block.request, offers: block.offers, refs, at: Date.now() };
  s.searches.push(stored);
  return stored;
}

export const lastSearch = (s: Session) => s.searches.at(-1);
