import type { Offer, Slice } from "./types";

/*
 * Times come in the airport's own offset (RFC 3339). The clock and date parts are read as written, never moved
 * into the viewer's zone: 08:15 in Madrid is shown as 08:15 wherever the traveller is.
 */

export const clock = (rfc3339: string) => rfc3339.slice(11, 16);

export const dayPart = (rfc3339: string) => rfc3339.slice(0, 10);

const DAY = 86_400_000;

/** Calendar days between departure and arrival as written on each board: the "+1" of an overnight flight. */
export function dayShift(from: string, to: string) {
  return Math.round((Date.parse(`${dayPart(to)}T00:00:00Z`) - Date.parse(`${dayPart(from)}T00:00:00Z`)) / DAY);
}

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}` : `${m}m`;
}

export function money(amount: number, currency: string, opts: { cents?: boolean } = {}) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: opts.cents ? 2 : 0,
      maximumFractionDigits: opts.cents ? 2 : 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(opts.cents ? 2 : 0)} ${currency}`;
  }
}

/** "Tue 15 Dec" from YYYY-MM-DD, read as a calendar date. */
export function dateLabel(isoDate: string, withYear = false) {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
}

export const totalMinutes = (o: Offer) => o.slices.reduce((a, s) => a + (s.duration_minutes || 0), 0);

export const maxStops = (o: Offer) => Math.max(0, ...o.slices.map((s) => s.stops));

/** Every airport the slice touches between its ends. */
export const viaAirports = (s: Slice) => s.segments.slice(0, -1).map((g) => g.destination);

export const carriers = (o: Offer) => [...new Set(o.slices.flatMap((s) => s.segments.map((g) => g.operating_carrier || g.marketing_carrier || o.airline)))];

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** "A3 703" from the carrier and a flight number that may or may not carry it already ("703", "A3703"). */
export function flightLabel(carrier: string | undefined, flightNumber: string | undefined) {
  const fn = (flightNumber ?? "").trim().toUpperCase();
  const c = (carrier ?? "").toUpperCase();
  if (!c) return fn;
  return fn.startsWith(c) ? `${c} ${fn.slice(c.length).trim()}` : `${c} ${fn}`;
}
