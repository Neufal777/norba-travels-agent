"use client";

import { createContext, useContext } from "react";
import { emptyTrip } from "@/lib/steps";
import type { FormSubmission, TripView } from "@/lib/types";

export type ChatActions = {
  /** With `form`, the text is what the traveller sees in their bubble; the details travel in the form. */
  send: (text: string, form?: FormSubmission) => void;
  busy: boolean;
  trip: TripView;
  /** IATA code → the airport or city name shown beside it. */
  places: Record<string, string>;
  /** The newest result list: older ones (before a filter or a new search) stay folded. */
  latestOffers?: string;
  /** Scrolls to the card of an offer ref (o4) and flashes it. */
  highlight: (ref: string) => void;
};

export const ChatContext = createContext<ChatActions>({ send: () => {}, busy: false, trip: emptyTrip(), places: {}, highlight: () => {} });

/** Spanish when the browser is, for the lines a form sends on the traveller's behalf. */
export const es = () => typeof navigator !== "undefined" && navigator.language.startsWith("es");

export const useChat = () => useContext(ChatContext);

/** Finds the newest card carrying the ref and points at it. */
export function highlightRef(ref: string) {
  const all = document.querySelectorAll<HTMLElement>(`[data-refs~="${ref}"]`);
  const el = all[all.length - 1];
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("na-flash");
  void el.offsetWidth;
  el.classList.add("na-flash");
  return true;
}
