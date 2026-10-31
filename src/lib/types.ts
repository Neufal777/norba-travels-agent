/*
 * Shapes shared by the server and the browser: the slice of the Norba API contract this app reads
 * (https://norba.io/docs, snake_case as on the wire) and the events the agent streams to the chat.
 */

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export type Segment = {
  segment_id?: string;
  origin: string;
  destination: string;
  /** RFC 3339 in the origin airport's own offset: the clock part is the departure board's time. */
  departure_utc: string;
  arrival_utc: string;
  flight_number?: string;
  marketing_carrier?: string;
  operating_carrier?: string;
  aircraft?: string;
  departure_terminal?: string;
  arrival_terminal?: string;
  duration_minutes?: number;
  cabin_class?: CabinClass;
  booking_class?: string;
};

export type Slice = {
  id?: string;
  origin: string;
  destination: string;
  departure_utc: string;
  arrival_utc: string;
  duration_minutes: number;
  stops: number;
  segments: Segment[];
};

export type FareBenefit = {
  type: string;
  included: boolean;
  description?: string;
  value?: string;
};

export type FareFamily = { id?: string; name?: string; description?: string; benefits?: FareBenefit[] };

export type FareRules = {
  refundable?: boolean | null;
  changeable?: boolean | null;
  refund_penalty_amount?: number;
  refund_penalty_currency?: string;
  change_penalty_amount?: number;
  change_penalty_currency?: string;
};

export type Ancillary = {
  type: string;
  name?: string;
  included_in_fare?: boolean;
  weight_kg?: number | null;
};

export type PassengerPricing = { type: "ADT" | "CHD" | "INF"; count: number; base_fare?: number; taxes?: number; total?: number };

export type Transfer = {
  airport: string;
  layover_minutes: number;
  overnight?: boolean;
  from_airline?: string;
  to_airline?: string;
};

export type Offer = {
  offer_id: string;
  airline: string;
  currency: string;
  total_amount: number;
  base_fare?: number;
  taxes_fees?: number;
  service_fee?: number;
  expires_at?: string;
  slices: Slice[];
  passengers?: PassengerPricing[];
  ancillaries_included?: Ancillary[];
  baggage_included?: boolean;
  fare_family?: FareFamily;
  fare_rules?: FareRules;
  cabin_class?: CabinClass;
  self_transfer?: boolean;
  transfers?: Transfer[];
};

export type PricedOffer = Offer & { price_guaranteed_until?: string };

export type SearchLeg = { origin: string; destination: string; departure_date: string };

export type SearchRequest = {
  origin?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  adults: number;
  children?: number;
  infants?: number;
  cabin_class?: CabinClass;
  currency?: string;
  max_stops?: number;
  legs?: SearchLeg[];
};

export type SearchMeta = { total?: number; airlines?: string[]; min_price?: number };

export type Airport = {
  iata_code: string;
  name: string;
  city?: string;
  country?: string;
  metro_code?: string;
  airport_type?: string;
  timezone?: string;
  page_rank?: number;
};

export type CalendarDay = { date: string; amount: number };

export type NetworkAirline = { airline: string; name: string; carriers: string[] };

export type Money = { amount: number; currency: string };

export type Seat = {
  seat_id?: string;
  row: number;
  column: string;
  cabin?: string;
  available: boolean;
  price?: Money;
  features?: string[];
  segment_id: string;
  passenger_id?: string;
};

export type SeatMap = { flight_id?: string; airline?: string; aircraft?: string; rows?: number; seats: Seat[] };

export type Service = {
  service_id: string;
  type: string;
  name: string;
  description?: string;
  price?: Money;
  segment_refs?: string[];
  pax_refs?: string[];
};

export type OfferQuote = {
  currency: string;
  base_fare?: number;
  taxes_fees?: number;
  fare_total: number;
  extras: number;
  service_fee: number;
  total: number;
};

export type PaxType = "ADT" | "CHD" | "INF";

export type Passenger = {
  id: string;
  type: PaxType;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "M" | "F";
  document?: { type: "P" | "I"; number: string; issuing_country: string; nationality: string; expiry_date: string };
};

export type Contact = { email: string; phone: string };

export type Ticket = { ticket_number?: string; passenger_id?: string; status?: string; type?: string };

export type Order = {
  order_id: string;
  airline: string;
  pnr?: string;
  status: string;
  environment?: "sandbox" | "production";
  currency?: string;
  total_amount?: number;
  expires_at?: string;
  passengers?: Passenger[];
  slices?: Slice[];
  tickets?: Ticket[];
  warnings?: string[];
};

// ── The trip: twelve steps from the first sentence to the e-tickets ──────────

export const STEPS = ["request", "airports", "search", "choose", "price", "seats", "extras", "travellers", "review", "payment", "booking", "tickets"] as const;

export type StepId = (typeof STEPS)[number];

export type StepStatus = "pending" | "running" | "waiting" | "done" | "failed" | "skipped";

export type StepState = { status: StepStatus; summary?: string; error?: string; startedAt?: number; endedAt?: number };

export type TripView = {
  steps: Record<StepId, StepState>;
  /** The step the trip is on: running, waiting for the traveller, or the next one to start. */
  current?: StepId;
  /** One line on what is happening right now. */
  now: string;
  pnr?: string;
};

/** A traveller as the forms know them before names are given: their id and type. */
export type PaxSlot = { id: string; type: PaxType; label: string };

// ── What the chat renders ─────────────────────────────────────────────────────

/** The labels the agent pins on offers so the traveller sees why one stands out. */
export type OfferTag = "cheapest" | "fastest" | "best";

export type OffersBlock = {
  kind: "offers";
  id: string;
  title: string;
  request: SearchRequest;
  offers: Offer[];
  /** Short handle per offer_id (o1, o2…) — what the agent and the traveller call an offer by. */
  refs: Record<string, string>;
  tags: Record<string, OfferTag[]>;
  airlines: string[];
  streaming: boolean;
  /** Set when this block is a filtered view of an earlier search: what was applied. */
  filter?: string;
};

export type CalendarBlock = {
  kind: "calendar";
  id: string;
  origin: string;
  destination: string;
  currency: string;
  days: CalendarDay[];
};

export type PricedBlock = { kind: "priced"; id: string; ref: string; offer: PricedOffer; previousAmount?: number };

export type RepliesBlock = { kind: "replies"; id: string; options: string[] };

export type SeatsBlock = { kind: "seats"; id: string; maps: { segment: Segment; map: SeatMap }[]; pax: PaxSlot[]; currency: string };

export type ExtrasBlock = { kind: "extras"; id: string; services: Service[]; pax: PaxSlot[]; segments: Segment[] };

export type TravellersBlock = { kind: "travellers"; id: string; pax: PaxSlot[]; international: boolean; prefill?: { passengers: Passenger[]; contact?: Contact } };

export type ReviewBlock = { kind: "review"; id: string; quote: OfferQuote; offer: PricedOffer; lines: { label: string; amount: number }[]; travellers: string[] };

export type PaymentBlock = { kind: "payment"; id: string; amount: number; currency: string; environment: "sandbox" | "production" | "mock"; holdUntil?: string };

export type BookingBlock = { kind: "booking"; id: string; order: Order; outcomeUnknown?: boolean };

/** A file the traveller attached to a message: an image or a PDF, as a data URL. */
export type Attachment = { id: string; name: string; mime: string; data: string };

/** One row of a departure board as read from a photo; `box` is [x_min, y_min, x_max, y_max] on a 0–1000 grid. */
export type BoardRow = { time: string; flight: string; destination: string; gate: string | null; status: string; box: number[] };

/** What Muse Spark read in an attachment (structured output). */
export type Perception = {
  kind: "trip_request" | "departure_board" | "boarding_pass" | "booking_confirmation" | "other";
  summary: string;
  facts: { label: string; value: string; box: number[] }[];
  trip: {
    destination_city: string | null;
    destination_iata: string | null;
    origin_city: string | null;
    event: string | null;
    event_date: string | null;
    depart_date: string | null;
    return_date: string | null;
    people: string[];
    notes: string | null;
  };
  board: { airport: string | null; rows: BoardRow[] };
};

/** The agent's reading of an attachment, drawn over it. `attachmentId` points at the file the browser still holds. */
export type VisionBlock = {
  kind: "vision";
  id: string;
  attachmentId: string;
  name: string;
  mime: string;
  model: string;
  perception?: Perception;
  /** The traveller's own flight found on a departure board. */
  match?: { rowIndex: number; flight: string; status: string; disrupted: boolean; pnr?: string };
  error?: string;
};

/** Other flights for a booked one, each with what it costs to move: 0 when the airline owes the move. */
export type RebookOption = { offerId: string; ref: string; slice: Slice; amount: number; currency: string; airline: string };

export type RebookBlock = {
  kind: "rebook";
  id: string;
  orderId: string;
  pnr?: string;
  reason: string;
  current: Slice;
  options: RebookOption[];
  /** Set once the traveller switched: the option taken. */
  switched?: string;
};

/** One flight a traveller's agent put forward for a group trip. */
export type GroupOption = {
  ref: string;
  airline: string;
  total: number;
  currency: string;
  fare?: string;
  bag: boolean;
  outbound: Slice;
  inbound?: Slice;
  reason?: string;
};

/** A traveller in a group trip, and what their own agent is doing for them. */
export type GroupLane = {
  id: string;
  name: string;
  origin: string;
  preferences?: string;
  status: "searching" | "choosing" | "ready" | "failed";
  /** Their agent's picks, best first. */
  shortlist: GroupOption[];
  /** Other flights the coordinator may use to land everyone together, at other times of day. */
  alternates?: GroupOption[];
  choice?: GroupOption;
  note?: string;
  /** Once held: the checkout link they pay on, and the booking once they did. */
  hold?: { url: string; total: number; currency: string; until?: string; paid?: boolean; pnr?: string; error?: string };
};

/** A trip for several people from several cities: one agent per traveller, a coordinator that fits them together. */
export type GroupBlock = {
  kind: "group";
  id: string;
  title: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  windowMinutes: number;
  budget?: number;
  currency: string;
  lanes: GroupLane[];
  coordinator: { status: "waiting" | "thinking" | "done" | "failed"; model?: string; rationale?: string; spreadMinutes?: number; checked?: string };
  holding?: boolean;
};

export type Block =
  | OffersBlock
  | CalendarBlock
  | PricedBlock
  | RepliesBlock
  | SeatsBlock
  | ExtrasBlock
  | TravellersBlock
  | ReviewBlock
  | PaymentBlock
  | BookingBlock
  | VisionBlock
  | RebookBlock
  | GroupBlock;

/** What a form in the chat sends with its message; the details stay on the server, the model sees a summary. */
export type FormSubmission =
  | { kind: "seats"; skip?: boolean; seats?: { segment_id: string; row: number; column: string; passenger_id: string }[] }
  | { kind: "extras"; skip?: boolean; extras?: { service_id: string; passenger_id?: string }[] }
  | { kind: "travellers"; passengers: Passenger[]; contact: Contact }
  | { kind: "payment"; card: { number: string; holder: string; expiry_month: number; expiry_year: number; cvv?: string } }
  /** Pressing Switch on an alternative: the traveller's consent to change a booked flight. */
  | { kind: "change"; blockId: string; offerId: string }
  /** Pressing Hold on a group plan: price every chosen flight and give each traveller a checkout link. */
  | { kind: "group_hold"; blockId: string };

export type ToolStatus = "running" | "done" | "error";

export type ToolStep = { id: string; name: string; label: string; status: ToolStatus; detail?: string };

export type Brain = { mode: "meta" | "offline"; model: string };

/** One line of the NDJSON stream POST /api/chat answers with. */
export type AgentEvent =
  | { type: "start"; conversationId: string; brain: Brain }
  | { type: "text"; delta: string }
  | { type: "tool"; step: ToolStep }
  | { type: "block"; block: Block }
  | { type: "offers_append"; blockId: string; offers: Offer[]; airlines: string[] }
  | { type: "offers_final"; block: OffersBlock }
  /** A block already in the chat, in any earlier message, replaced by its newer state. */
  | { type: "patch"; block: Block }
  | { type: "trip"; trip: TripView }
  /** Airport and city names by IATA code, for every code the chat shows. */
  | { type: "places"; places: Record<string, string> }
  | { type: "error"; message: string }
  | { type: "done" };

export type ChatPart = { kind: "text"; text: string } | { kind: "tool"; step: ToolStep } | { kind: "block"; block: Block };

export type ChatMessage = { id: string; role: "user" | "assistant"; parts: ChatPart[]; at: number; failed?: string; form?: FormSubmission["kind"]; attachments?: Attachment[] };

export type AppStatus = {
  brain: Brain;
  norba: { mode: "live" | "mock"; environment: "sandbox" | "production" | "mock"; baseUrl: string };
};
