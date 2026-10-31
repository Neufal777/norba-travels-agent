import { getCheckout, payCheckout } from "@/server/checkout";
import { FormError, validCard, validContact, validPassengers } from "@/server/agent/forms";
import { NorbaError } from "@/server/norba/port";
import type { Contact, Passenger } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Body = { passengers?: Passenger[]; contact?: Contact; card?: { number: string; holder: string; expiry_month: number; expiry_year: number; cvv?: string }; locale?: string };

/** Pay on a checkout link: the traveller's details and card are checked as in the chat, then the airline books. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const c = getCheckout((await params).token);
  if (!c) return Response.json({ error: "This link has expired." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Body;
  try {
    const passengers = validPassengers(body.passengers, c.slots, c.offer);
    const contact = validContact(body.contact);
    const { card } = validCard(body.card);
    const { order, outcomeUnknown } = await payCheckout(c, passengers, contact, card, body.locale?.startsWith("es") ? "es" : "en");
    return Response.json({
      order: { order_id: order.order_id, pnr: order.pnr, status: order.status, environment: order.environment, total_amount: order.total_amount, currency: order.currency, slices: order.slices, tickets: order.tickets },
      outcomeUnknown,
    });
  } catch (e) {
    if (e instanceof FormError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof NorbaError) return Response.json({ error: e.message, code: e.code }, { status: e.status >= 500 ? 502 : e.status === 409 ? 409 : 422 });
    // Never log the body: it holds a card number.
    console.error("[pay]", (e as Error)?.message);
    return Response.json({ error: "The booking could not be made." }, { status: 500 });
  }
}
