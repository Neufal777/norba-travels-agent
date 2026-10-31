import "server-only";

import type { Attachment, BoardRow, Order, Perception } from "@/lib/types";
import { flightLabel } from "@/lib/format";
import { structured, type CallOptions } from "../llm/meta";
import type { ContentPart } from "../llm/types";

/*
 * The agent's eyes: Muse Spark reads what the traveller attaches — an invitation, a screenshot of a chat, a PDF, a
 * photo of a departure board — and answers in a fixed JSON shape (structured output), with a box around every fact
 * it read so the chat can show where it found it.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ATTACHMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];
/** Decoded bytes per attachment; the Model API takes up to 50 MB inline, a chat needs far less. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const BOX = {
  type: "array",
  items: { type: "integer" },
  description: "[x_min, y_min, x_max, y_max] on a 0–1000 grid of the image (0,0 is top-left); [] for a PDF or when the fact has no single place",
};

const nullable = (description: string) => ({ type: ["string", "null"], description });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "summary", "facts", "trip", "board"],
  properties: {
    kind: {
      type: "string",
      enum: ["trip_request", "departure_board", "boarding_pass", "booking_confirmation", "other"],
      description: "trip_request: anything that implies a journey (invitation, event, message, itinerary idea)",
    },
    summary: { type: "string", description: "One sentence on what this is, in the traveller's language" },
    facts: {
      type: "array",
      description: "Every fact read that matters for a trip, each with where it is in the image",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "box"],
        properties: {
          label: { type: "string", enum: ["place", "date", "time", "people", "event", "flight", "airport", "status", "other"] },
          value: { type: "string" },
          box: BOX,
        },
      },
    },
    trip: {
      type: "object",
      additionalProperties: false,
      description: "For trip_request, booking_confirmation and boarding_pass; nulls and [] otherwise",
      required: ["destination_city", "destination_iata", "origin_city", "event", "event_date", "depart_date", "return_date", "people", "notes"],
      properties: {
        destination_city: nullable("City the trip goes to"),
        destination_iata: nullable("Its airport or metropolitan IATA code when you are sure, else null"),
        origin_city: nullable("City the trip starts from, only when the document says so"),
        event: nullable("What the trip is for, e.g. 'María & Nikos's wedding'"),
        event_date: nullable("YYYY-MM-DD of the event, if any"),
        depart_date: nullable("YYYY-MM-DD to fly out: the day before an event unless the document says otherwise"),
        return_date: nullable("YYYY-MM-DD to fly back: the day after an event unless the document says otherwise"),
        people: { type: "array", items: { type: "string" }, description: "Names of the people invited or travelling, as written" },
        notes: nullable("Anything else that matters for booking (dress code is not; 'arrive by 16:00' is)"),
      },
    },
    board: {
      type: "object",
      additionalProperties: false,
      description: "For departure_board: every legible row; null and [] otherwise",
      required: ["airport", "rows"],
      properties: {
        airport: nullable("Airport the board is in, if shown"),
        rows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["time", "flight", "destination", "gate", "status", "box"],
            properties: {
              time: { type: "string", description: "HH:MM as shown" },
              flight: { type: "string", description: "Flight number as shown, e.g. 'A3 703'" },
              destination: { type: "string" },
              gate: nullable("Gate, if shown"),
              status: { type: "string", description: "Remark as shown, e.g. CANCELLED, DELAYED 21:05, BOARDING, ON TIME" },
              box: BOX,
            },
          },
        },
      },
    },
  },
};

function instructions(today: string) {
  return `You read what a traveller attached to a chat with a flight-booking agent and return exactly the JSON asked for.
Today is ${today}. A date without a year is its next occurrence from today. Write dates as YYYY-MM-DD.
Only report what you can read; never guess a flight number, time or name. Leave unknown fields null.
Boxes are [x_min, y_min, x_max, y_max] on a 0–1000 grid of the image, tight around the text you read.
For a departure board, report every legible row, its status exactly as written, and the box of the whole row.`;
}

/** The base64 payload's decoded size, from a data URL. */
export const dataUrlBytes = (url: string) => Math.floor(((url.length - url.indexOf(",") - 1) * 3) / 4);

export function validAttachment(a: Attachment) {
  if (!ATTACHMENT_TYPES.includes(a.mime)) return `${a.name}: only images (JPEG, PNG, WebP, GIF) and PDFs`;
  if (!a.data.startsWith(`data:${a.mime};base64,`)) return `${a.name}: not a file the chat can read`;
  if (dataUrlBytes(a.data) > MAX_ATTACHMENT_BYTES) return `${a.name}: larger than 8 MB`;
  return undefined;
}

function part(a: Attachment): ContentPart {
  return a.mime === "application/pdf" ? { type: "file", file: { filename: a.name, file_data: a.data } } : { type: "image_url", image_url: { url: a.data } };
}

const clampBox = (b: number[]) => (b.length === 4 ? b.map((n) => Math.max(0, Math.min(1000, Math.round(n)))) : []);

/** Muse Spark reads one attachment. */
export async function perceive(a: Attachment, today: string, o: CallOptions = {}): Promise<Perception> {
  const p = await structured<Perception>(
    [
      { role: "system", content: instructions(today) },
      { role: "user", content: [{ type: "text", text: `The traveller attached "${a.name}". What is it, and what does it say about a trip?` }, part(a)] },
    ],
    "attachment_reading",
    SCHEMA,
    o,
  );
  p.facts = (p.facts ?? []).map((f) => ({ ...f, box: clampBox(f.box ?? []) }));
  if (p.board) p.board.rows = (p.board.rows ?? []).map((r) => ({ ...r, box: clampBox(r.box ?? []) }));
  return p;
}

/** "A3 703", "A3703" and "a3-0703" are the same flight. */
export const flightKey = (f: string) => {
  const m = f.toUpperCase().replace(/[^A-Z0-9]/g, "").match(/^([A-Z0-9]{2})(\d{1,4})[A-Z]?$/);
  return m ? `${m[1]}${Number(m[2])}` : f.toUpperCase().replace(/\s+/g, "");
};

export type BoardMatch = { row: BoardRow; rowIndex: number; order: Order; sliceIndex: number; segmentId?: string; disrupted: boolean };

/** Finds the traveller's own flight among the board's rows, by flight number, across every order of the conversation. */
export function matchBoard(p: Perception, orders: Order[]): BoardMatch | undefined {
  const rows = p.board?.rows ?? [];
  for (const order of orders)
    for (const [sliceIndex, s] of (order.slices ?? []).entries())
      for (const g of s.segments) {
        if (!g.flight_number) continue;
        const want = flightKey(flightLabel(g.marketing_carrier ?? order.airline, g.flight_number));
        const rowIndex = rows.findIndex((r) => flightKey(r.flight) === want || flightKey(r.flight) === flightKey(g.flight_number!));
        if (rowIndex >= 0) {
          const row = rows[rowIndex];
          return { row, rowIndex, order, sliceIndex, segmentId: g.segment_id, disrupted: /cancel|annul|delay|retras|divert/i.test(row.status) };
        }
      }
  return undefined;
}

/** What the agent's transcript keeps of an attachment: the reading, never the image. */
export function perceptionNote(a: Attachment, p: Perception, match?: BoardMatch) {
  const lines = [`[Attachment "${a.name}", read with Muse Spark vision] ${p.kind}: ${p.summary}`];
  if (p.facts.length) lines.push(`Facts: ${p.facts.map((f) => `${f.label}=${f.value}`).join("; ")}`);
  const t = p.trip;
  if (p.kind !== "departure_board" && t && (t.destination_city || t.depart_date)) {
    lines.push(
      `Trip: to ${t.destination_city ?? "?"}${t.destination_iata ? ` (${t.destination_iata})` : ""}${t.origin_city ? ` from ${t.origin_city}` : ""}` +
        `${t.event ? `, for ${t.event}` : ""}${t.event_date ? ` on ${t.event_date}` : ""}; out ${t.depart_date ?? "?"}, back ${t.return_date ?? "?"}` +
        `${t.people.length ? `; people: ${t.people.join(", ")}` : ""}${t.notes ? `; ${t.notes}` : ""}`,
    );
  }
  if (p.kind === "departure_board") {
    lines.push(`Board rows: ${(p.board?.rows ?? []).map((r) => `${r.time} ${r.flight} ${r.destination} ${r.status}`).join(" | ") || "none legible"}`);
    if (match) {
      const g = match.order.slices?.[match.sliceIndex];
      lines.push(
        `MATCH: the traveller's booked flight ${match.row.flight} (order ${match.order.pnr ?? match.order.order_id}, ${g?.origin}→${g?.destination}) shows "${match.row.status}".` +
          (match.disrupted ? " It is disrupted: call find_rebooking for that order now." : " It is not disrupted."),
      );
    } else {
      lines.push("No row matches a flight booked in this conversation.");
    }
  }
  return lines.join("\n");
}
