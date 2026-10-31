# Norba Travels Agent

Tell it where you want to go — *"Madrid to Athens next Friday, back on Sunday, two adults"* — and an agent built on
**Meta's Muse Spark** takes it from the first sentence to the e-tickets through the **Norba API**, which talks to the
airlines directly (NDC, New Distribution Capability): live offers streamed as cards, filters by talking ("only
non-stop", "leave after 10", "with a bag"), the airline's price check, seat maps, bags and extras, traveller details,
the full quote, card payment and the order with its booking reference. A side panel follows the twelve steps of the
trip and says, at every moment, what is happening or what the agent waits for.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), Startups track, theme *Build for Your
World*. [Norba](https://norba.io) is our own startup: a flight-distribution API that connects travel businesses to the
airlines through NDC. This agent is what we built on top of it during the hackathon.

## Built during the hackathon, and what already existed

Everything in this repository was written during the hackathon's building period, starting on 30 October 2026; the
commit history starts there. That covers the agent and the whole app:

- the agent loop on the Meta Model API (streaming, tool calls, reasoning effort) and the system prompt;
- every tool, the twelve-step trip state and the booking flow, with payment kept away from the model;
- the offline planner and the mock Norba client used for development without keys;
- the chat interface, the trip panel, the result cards, the booking forms and the airport drawing.

What already existed and is used, not claimed:

- **The Norba API** (`api.norba.io`): the existing product of Norba, our own startup, which connects to the
  airlines. This repository only calls it over HTTPS.
- **The isometric drawing toolkit** in `src/components/drawing/iso.tsx`: ported from the Norba landing page (same
  author). The airport scene drawn with it, `hero-airport.tsx`, is new.
- **The visual base**: the palette tokens' structure, the button and tooltip components and the motion utilities in
  `src/app/globals.css` and `src/components/ui/` are adapted from the author's earlier project Ticket Pilot, recoloured to
  the Norba brand.
- **Open-source libraries** listed in `package.json` (Next.js, React, Tailwind CSS, Radix UI, lucide-react, sonner,
  date-fns).

## How it works

```
browser ──POST /api/chat──▶ agent loop ──Chat Completions + tools──▶ Meta Model API (muse-spark-1.3)
   ▲                            │
   └──── NDJSON events ◀────────┤ tool calls
         (text, steps,          ▼
          offer cards)      Norba API: /v1/aviation/airports · /v1/shopping/offers/stream
                                       /v1/shopping/calendar · /v1/offers/price · /v1/network/airlines
```

- **The model never sees raw offers.** A search returns 50–150 offers of a few KB each; the model gets a digest
  (itineraries grouped by flights, best-ranked first, each fare with a short ref like `o4`) while the browser receives
  the full offers as they stream in, airline by airline.
- **Follow-ups are free.** `refine_results` filters and re-sorts the last search in memory: no new airline request, no
  new metered call.
- **Refs tie text to cards.** When the agent writes `o4`, it is a chip that scrolls to and flashes that card.
- **Personal data never reaches the model.** Travellers and card are filled in forms inside the chat that post to
  this server only; the model reads a note (first names, "VISA ending 4242"). The card lives for the booking request
  and is wiped after it, whatever the outcome.
- **Only a person spends money.** The model can open the payment form but cannot book: the order is created when the
  traveller presses Pay, for the amount they saw, with one Idempotency-Key per attempt so a retry never books twice.

### The twelve steps

| Phase | Steps |
| --- | --- |
| Plan | 01 Your request · 02 Airports · 03 Airline search |
| Choose | 04 Your flight · 05 Price check · 06 Seats |
| Prepare | 07 Bags & extras · 08 Travellers · 09 Review |
| Book | 10 Payment · 11 Booking · 12 E-tickets |

Every tool moves its step (running, waiting for you, done, skipped, failed) and the server streams the whole trip
to the panel; the model also reads it on every turn, so it always knows what comes next.

### Agent tools

| Tool | What it does | Norba endpoint |
| --- | --- | --- |
| `ask_payment` | Card form with the reviewed total | — |
| `ask_traveller_details` | Traveller and contact form | — |
| `choose_extras` | Bags and extras the airline sells with the fare | `GET /v1/offers/{id}/services` |
| `choose_seats` | Seat map of every flight | `GET /v1/offers/{id}/seats` |
| `find_airports` | City / airport name → IATA (International Air Transport Association) or metro code | `GET /v1/aviation/airports?q=` |
| `list_airlines` | Airlines a search reaches | `GET /v1/network/airlines` |
| `price_calendar` | Cheapest fare per day, for flexible dates | `GET /v1/shopping/calendar` |
| `price_offer` | Confirm the chosen offer's price with the airline | `POST /v1/offers/price` |
| `refine_results` | Filter / re-sort the last search locally | — |
| `review_price` | The whole total, line by line | `POST /v1/offers/quote` |
| `search_flights` | One-way, round-trip or multi-city search, streamed | `POST /v1/shopping/offers/stream` |
| `skip_step` | Skip seats or extras | — |
| `suggest_replies` | Tappable answers under the message | — |

Pressing Pay runs `book_trip` (`POST /v1/orders` with the card), which the model is not given.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: everything works with it empty
npm run dev                  # http://localhost:3200
```

It runs in three combinations, picked from the environment:

| `MODEL_API_KEY` | `NORBA_API_KEY` | What you get |
| --- | --- | --- |
| empty | empty | **Offline planner + mock flights.** Rule-based Spanish/English parsing drives the same tools through the whole booking; offers, seat maps, extras and orders are generated locally (card 4242 4242 4242 4242 books, 4000 0000 0000 0002 is declined). Good for UI work. |
| empty | `nbr_test_…` | Offline planner on real airline sandbox offers. |
| set | set | **The real thing:** Muse Spark plans, Norba searches. |

Every keyed Norba request is metered, so the mock is the default while building the interface.

### Switching the model on

The Meta Model API speaks OpenAI-compatible Chat Completions, so the client is a plain `fetch` with streaming and tool
calls (`src/server/llm/meta.ts`):

```bash
MODEL_API_KEY=…                      # from the Meta developer dashboard
MODEL_BASE_URL=https://api.meta.ai/v1
MODEL_ID=muse-spark-1.3              # GET /v1/models lists what your team can use
MODEL_REASONING_EFFORT=low           # minimal | low | medium | high | xhigh | max, or empty
```

The same variables point it at Llama open weights on Baseten, Fireworks or Modal (their OpenAI-compatible endpoints):
change the base URL and model id, and leave `MODEL_REASONING_EFFORT` empty if the provider does not take it.

## Layout

```
src/
  app/api/chat        POST: one chat turn or form answer, answered as NDJSON events
  app/api/status      which model and which Norba environment are in use
  server/agent        the loop (run.ts), shopping and booking tools, forms, the trip's steps, prompt, offline planner
  server/llm          Meta Model API client (Chat Completions, streaming, tool calls)
  server/norba        Norba client: live (X-API-Key) and mock, behind one interface
  components/chat     chat UI: trip panel, messages, offer cards, seat map, extras, forms, receipt, confirmation
  lib                 types shared by server and browser, offer grouping and ranking, formatting
```

Conversations and trips live in server memory for three hours (`server/agent/sessions.ts`); several instances would need a
shared store such as Redis.

## Design

Norba's brand: Cloud, Mist, Stone, Slate and Midnight with Vermilion for action, the Norba mark drawn in SVG, square
corners, hairline borders, mono uppercase eyebrows, 6 px square markers and the rising-fill buttons with the sliding
boxed arrow. Chat-specific motion (messages rising in, the square caret while the agent writes, a square crossing the
flight line while airlines answer, the hero's flying square) honours `prefers-reduced-motion`. Light and dark themes.
