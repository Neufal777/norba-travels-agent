import { STEPS, type StepId, type StepState, type TripView } from "./types";

export const STEP_LABELS: Record<StepId, { title: string; hint: string }> = {
  request: { title: "Your request", hint: "Where, when, who and what matters" },
  airports: { title: "Airports", hint: "Cities turned into airport codes" },
  search: { title: "Airline search", hint: "Every connected airline, live" },
  choose: { title: "Your flight", hint: "Compare and pick one" },
  price: { title: "Price check", hint: "The airline confirms the fare" },
  seats: { title: "Seats", hint: "Pick seats, or skip" },
  extras: { title: "Bags & extras", hint: "Add bags, or skip" },
  travellers: { title: "Travellers", hint: "Names as on the passport, contact" },
  review: { title: "Review", hint: "The whole price, line by line" },
  payment: { title: "Payment", hint: "Card details — you press Pay" },
  booking: { title: "Booking", hint: "The airline creates the order" },
  tickets: { title: "E-tickets", hint: "Booking reference and tickets" },
};

export const PHASES: { title: string; steps: StepId[] }[] = [
  { title: "Plan", steps: ["request", "airports", "search"] },
  { title: "Choose", steps: ["choose", "price", "seats"] },
  { title: "Prepare", steps: ["extras", "travellers", "review"] },
  { title: "Book", steps: ["payment", "booking", "tickets"] },
];

export const isFinished = (s: StepState) => s.status === "done" || s.status === "skipped";

export function emptyTrip(): TripView {
  return { steps: Object.fromEntries(STEPS.map((s) => [s, { status: "pending" }])) as TripView["steps"], current: "request", now: "Tell the agent where you want to go." };
}
