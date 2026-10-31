import type { Airport, CalendarDay, Contact, NetworkAirline, Offer, OfferQuote, Order, Passenger, PricedOffer, SearchMeta, SearchRequest, SeatMap, Service } from "@/lib/types";

export type SearchResult = { searchId: string; offers: Offer[]; meta: SearchMeta; expiresAt?: string };

export type CalendarQuery = {
  origin: string;
  destination: string;
  from: string;
  to: string;
  trip_type?: "one_way" | "round_trip";
  departure_date?: string;
  cabin_class?: string;
  currency?: string;
};

export type ChosenSeat = { segment_id: string; row: number; column: string; passenger_id: string };

export type ChosenExtra = { ancillary_offer_id: string; passenger_id?: string; segment_ids?: string[] };

export type CardData = { number: string; holder: string; expiry_month: number; expiry_year: number; cvv?: string; brand?: string };

export type OrderRequest = {
  offer: PricedOffer;
  passengers: Passenger[];
  contact: Contact;
  seats: ChosenSeat[];
  extras: ChosenExtra[];
  payment: { amount: number; currency: string; card: CardData };
  locale: "en" | "es";
};

/** An order the airline made, and whether the card may have been charged without an answer (do not pay again). */
export type OrderResult = { order: Order; outcomeUnknown: boolean };

/** Alternatives for a booked flight: the slice to replace and, for a move to another day, the new date. */
export type ReshopQuery = { sliceIndex: number; segmentIds?: string[]; date?: string };

/** What the agent needs from Norba. The live client and the mock both answer it. */
export interface NorbaPort {
  /** Calls `onBatch` as each airline answers, then resolves with every offer, cheapest first. */
  search(req: SearchRequest, onBatch: (offers: Offer[]) => void, signal?: AbortSignal): Promise<SearchResult>;
  price(offer: Offer): Promise<PricedOffer>;
  calendar(q: CalendarQuery): Promise<{ currency: string; days: CalendarDay[] }>;
  airports(query: string): Promise<Airport[]>;
  /** The airports and metropolitan codes behind a list of IATA codes, in one call. */
  airportsByCode(codes: string[]): Promise<Airport[]>;
  networkAirlines(): Promise<NetworkAirline[]>;
  /** The seat map of one segment of a priced offer; null when the airline has none for it. */
  seatMap(offer: PricedOffer, segmentId: string): Promise<SeatMap | null>;
  services(offer: PricedOffer): Promise<Service[]>;
  quote(offer: PricedOffer, seats: ChosenSeat[], extras: ChosenExtra[]): Promise<OfferQuote>;
  /** Books and pays. `idempotencyKey` is the same on every retry of one booking. */
  createOrder(req: OrderRequest, idempotencyKey: string): Promise<OrderResult>;
  getOrder(orderId: string, airline: string): Promise<Order>;
  /** Alternative flights for an order (OrderReShop). Each offer's total_amount is the difference owed (+) or back (−). */
  reshop(order: Order, q: ReshopQuery): Promise<Offer[]>;
  /** Accepts a reshop offer and reissues the order. A positive difference needs `payment`. */
  changeOrder(order: Order, offerId: string, idempotencyKey: string, payment?: OrderRequest["payment"]): Promise<OrderResult>;
}

/** A refusal from the Norba API, with the stable `code` to branch on when it sent one. */
export class NorbaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "NorbaError";
  }
}
