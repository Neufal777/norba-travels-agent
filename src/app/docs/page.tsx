import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFooter } from "@/components/app-footer";
import { NorbaWordmark } from "@/components/brand";
import { Sq } from "@/components/status";
import { brain } from "@/server/agent/run";
import { config, norbaEnvironment, openModelMode } from "@/server/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Docs",
  description: "How Norba Travels Agent works: the Meta models it runs on, the Norba API it books through, its own routes, the MCP server and every setting.",
};

const SECTIONS = [
  ["provenance", "Built during the hackathon"],
  ["overview", "Overview"],
  ["architecture", "Architecture"],
  ["meta", "Meta models"],
  ["meta-api", "Meta Model API calls"],
  ["norba", "Norba API"],
  ["routes", "This app's routes"],
  ["tools", "Agent tools"],
  ["stream", "Chat stream"],
  ["mcp", "MCP server"],
  ["flows", "Flows"],
  ["safety", "Safety and privacy"],
  ["config", "Configuration"],
  ["modes", "Run modes"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 border-t border-hr-line pt-10 first:border-t-0 first:pt-0">
      <h2 className="text-[22px] tracking-[-0.02em] text-hr-ink-strong">{title}</h2>
      {children}
    </section>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="max-w-[72ch] text-[14px] leading-[1.65] text-hr-ink-2">{children}</p>;

const C = ({ children }: { children: React.ReactNode }) => <code className="border border-hr-line bg-hr-surface-2 px-1 py-px font-mono text-[12px] text-hr-ink-strong">{children}</code>;

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="overflow-hidden border border-hr-line-strong/70 bg-hr-surface-2">
      {label && <figcaption className="border-b border-hr-line px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">{label}</figcaption>}
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-[1.6] text-hr-ink-2">{children}</pre>
    </figure>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-hr-line-strong/70">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="bg-hr-surface-2">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-hr-line px-3 py-2 font-mono text-[10px] font-normal uppercase tracking-[0.06em] text-hr-ink-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hr-line">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "whitespace-nowrap px-3 py-2 text-hr-ink-strong" : "px-3 py-2 leading-[1.55] text-hr-ink-2"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ARCHITECTURE = `browser ──POST /api/chat──▶ agent loop ──Chat Completions + tools──▶ Meta Model API (Muse Spark)
   ▲  ▲                        │   └── structured output · vision ──▶ reading files, group agents, coordinator
   │  └─ GET /api/updates ◀─┐  │ tool calls
   └── NDJSON events ◀──────┤  ▼
                            │ Norba API ──▶ the airlines (NDC)
Norba webhooks ─────────────┘ order.schedule_changed → the conversation that booked it

/agency ──▶ Muse Spark Open (Baseten) ──▶ Norba API
other AI assistants ──MCP /api/mcp──▶ search · price · checkout link ──▶ /pay/<token>, where the traveller books`;

const CHAT_CALL = `POST https://api.meta.ai/v1/chat/completions
Authorization: Bearer $MODEL_API_KEY

{
  "model": "muse-spark-1.3",
  "messages": [{ "role": "system", "content": "…the trip's twelve steps, today's date, the rules…" }, …],
  "tools": [{ "type": "function", "function": { "name": "search_flights", "parameters": {…} } }, …],
  "tool_choice": "auto",
  "parallel_tool_calls": false,
  "stream": true,
  "reasoning_effort": "low"
}`;

const VISION_CALL = `POST https://api.meta.ai/v1/chat/completions

{
  "model": "muse-spark-1.3",
  "messages": [
    { "role": "system", "content": "You read what a traveller attached… boxes on a 0–1000 grid…" },
    { "role": "user", "content": [
      { "type": "text", "text": "The traveller attached \\"invitation.jpg\\"…" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,…" } }
    ] }
  ],
  "response_format": { "type": "json_schema", "json_schema": { "name": "attachment_reading", "strict": true, "schema": {…} } }
}
// A PDF goes as { "type": "file", "file": { "filename": "policy.pdf", "file_data": "data:application/pdf;base64,…" } }`;

const ASR_CALL = `POST https://api.meta.ai/v1/asr/transcribe          (multipart/form-data)
request = {"mode":"PUSH_TO_TALK","model":"muse-voice-transcribe-1.0","audioEncoding":"WAV",
           "languageBias":["Spanish","English"],"keywords":["Heathrow","Aegean",…]}
audio   = speech.wav   (mono, 16-bit PCM, 24 kHz — encoded in the browser)
→ { "transcript": "Madrid to Athens on the eleventh of December", "audioDurationMs": 2100, … }`;

const MCP_CALLS = `POST /api/mcp   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18",…}}
← Mcp-Session-Id: 0a8f…   {"result":{"serverInfo":{"name":"norba",…},"capabilities":{"tools":{}},"instructions":"…"}}

POST /api/mcp   {"jsonrpc":"2.0","id":2,"method":"tools/call",
                 "params":{"name":"search_flights","arguments":{"origin":"MAD","destination":"ATH","departure_date":"2026-12-11"}}}
← {"result":{"content":[{"type":"text","text":"12 offers, 4 itineraries… o2 Basic €302…"}],"structuredContent":{"offers":[…]}}}

POST /api/mcp   {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"create_checkout","arguments":{"ref":"o2"}}}
← {"result":{"content":[{"type":"text","text":"Aegean Airlines confirmed €302.00, price held for 19 min. Checkout: https://…/pay/9626…"}]}}`;

/** The project's documentation: what it does, which Meta models and Norba endpoints it uses, and how to run it. */
export default function Docs() {
  const b = brain();
  const open = openModelMode();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hr-frost sticky top-0 z-40 border-b border-hr-line">
        <div className="mx-auto flex h-12 w-full max-w-[1120px] items-center gap-4 px-5 md:px-10">
          <Link href="/" className="cursor-pointer no-underline">
            <NorbaWordmark sub="Docs" />
          </Link>
          <span className="ml-auto hidden items-center gap-4 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 md:inline-flex">
            <span className="inline-flex items-center gap-1.5">
              <Sq className={b.mode === "meta" ? "bg-hr-success" : "bg-hr-concrete"} /> {b.model}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sq className={open === "open" ? "bg-hr-success" : "bg-hr-concrete"} /> desk: {open === "open" ? config.openModel.id : open === "meta" ? "Muse Spark stand-in" : "off"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sq className={norbaEnvironment() === "mock" ? "bg-hr-concrete" : "bg-hr-success"} /> Norba · {norbaEnvironment()}
            </span>
          </span>
          <Link href="/" className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 no-underline hover:text-hr-ink-strong">
            <ArrowLeft className="size-3" /> Agent
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] flex-1 gap-10 px-5 py-10 md:px-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-20 space-y-1.5">
            {SECTIONS.map(([id, title], i) => (
              <li key={id}>
                <a href={`#${id}`} className="flex cursor-pointer gap-2 text-[12.5px] text-hr-ink-3 no-underline transition-colors hover:text-hr-ink-strong">
                  <span className="w-5 font-mono text-[10px] tabular-nums leading-[1.9] text-hr-ink-4">{String(i + 1).padStart(2, "0")}</span>
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="min-w-0 space-y-10">
          <section id="provenance" aria-labelledby="provenance-title" className="scroll-mt-20 border-2 border-hr-rust bg-[color-mix(in_srgb,var(--hr-rust)_6%,transparent)]">
            <h2 id="provenance-title" className="flex items-center gap-2 bg-hr-rust px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.08em] text-white">
              <span className="size-1.5 bg-white" /> Built during the hackathon
            </h2>
            <div className="space-y-4 p-4">
              <p className="max-w-[72ch] text-[14px] leading-[1.65] text-hr-ink-strong">
                Everything in this repository was written during the Meta Global AI Developer Hackathon&apos;s building period, from 30 October 2026: the agent and its prompt, every
                tool, vision, voice, group trips, the guardian, checkout links, the agency desk, the MCP server and the terminal assistant, the mock, and the interface.
              </p>
              <Table
                head={["Already existed", "How it is used"]}
                rows={[
                  ["Open-source libraries", "Next.js, React, Tailwind CSS, Radix UI, lucide-react, sonner, date-fns"],
                  ["The isometric drawing toolkit", "iso.tsx, ported from the Norba landing page (same author); the airport scene is new"],
                  ["The Norba API", "Norba is our own startup; its existing API is called over HTTPS"],
                ]}
              />
            </div>
          </section>

          <div className="space-y-3">
            <p className="hr-eyebrow flex items-center gap-2">
              <span className="hr-sq" /> Documentation
            </p>
            <h1 className="text-[34px] leading-tight tracking-[-0.03em] text-hr-ink-strong md:text-[42px]">Norba Travels Agent</h1>
            <P>
              A travel agent built on Meta&apos;s models that books real flights through the Norba API. This page covers everything it uses and exposes: the Meta model calls, the
              Norba endpoints, its own routes, the tools the model can call, the MCP server for other assistants, the safety rules and every setting.
            </P>
          </div>

          <Section id="overview" title="Overview">
            <Table
              head={["Capability", "What happens", "Where"]}
              rows={[
                ["Agency desk", "Client requests read, options checked against the company's travel policy, the reply drafted; the agent at the desk approves and a checkout link is made", <C key="a">/agency</C>],
                ["Booking layer for assistants", "Any AI assistant connects over MCP and gets real airline search and checkout links, never a card", <C key="m">/api/mcp</C>],
                ["Chat booking", "From a sentence, a voice note or a file to the booking reference: search, price, seats, bags, travellers, card", <C key="c">/</C>],
                ["Group trips", "One agent per traveller shortlists from their city; a coordinator lands everyone together; each pays their own link", <C key="g">/ · plan_group_trip</C>],
                ["Trip guardian", "An airline's schedule change, or a photo of a departure board, leads the agent to explain it and offer other flights; Switch changes the booking", <C key="r">/ · find_rebooking</C>],
              ]}
            />
          </Section>

          <Section id="architecture" title="Architecture">
            <Code>{ARCHITECTURE}</Code>
            <P>
              A Next.js app (App Router) with its server in <C>src/server</C>. Every chat turn is one <C>POST /api/chat</C> answered as a stream of NDJSON events. The agent loop
              (<C>src/server/agent/run.ts</C>) asks Muse Spark, runs the tools it calls against Norba, gives it the results and repeats, up to eight rounds per message.
              Conversations, checkout links and mock state live in server memory for a few hours.
            </P>
          </Section>

          <Section id="meta" title="Meta models">
            <Table
              head={["Model", "Used for", "Features used", "Code"]}
              rows={[
                ["Muse Spark 1.3", "The chat agent: plans the trip, calls tools, writes every answer", "Chat Completions, streaming, tool calling, reasoning_effort", <C key="1">server/llm/meta.ts · complete()</C>],
                ["Muse Spark 1.3", "Each traveller's own agent in a group trip: shortlists their best three with a reason", "Structured output (json_schema, strict)", <C key="2">server/agent/group.ts</C>],
                ["Muse Spark 1.3 · reasoning high", "The group coordinator: one flight per traveller inside the arrival window and budget", "Structured output, reasoning_effort=high", <C key="3">server/agent/group.ts</C>],
                ["Muse Spark 1.3 · vision", "Reads invitations, screenshots, PDFs and departure boards; a policy PDF into rules", "image_url and file content parts, structured output, 0–1000 boxes", <C key="4">server/agent/vision.ts</C>],
                ["Muse Spark Open", "The agency desk: reads requests, checks the travel policy, drafts replies", "Open weights on Baseten (OpenAI-compatible), structured output", <C key="5">server/agency.ts</C>],
                ["Muse Voice Transcribe", "Dictation in the chat", "POST /v1/asr/transcribe, WAV 24 kHz mono, language bias, keywords", <C key="6">server/llm/voice.ts</C>],
              ]}
            />
            <P>
              Without <C>OPEN_MODEL_API_KEY</C> the desk runs on Muse Spark and says so on every step. Without <C>MODEL_API_KEY</C> a rule-based planner drives the same tools; vision,
              voice, group agents and the desk need a model.
            </P>
          </Section>

          <Section id="meta-api" title="Meta Model API calls">
            <P>The client is a plain fetch against the OpenAI-compatible endpoints (no SDK). Three kinds of call:</P>
            <Code label="The agent — streamed, with tools">{CHAT_CALL}</Code>
            <Code label="Vision and structured output — one JSON answer">{VISION_CALL}</Code>
            <Code label="Muse Voice Transcribe">{ASR_CALL}</Code>
            <P>
              The model never receives raw offers or files: a search becomes a digest of itineraries with short refs (<C>o4</C>), and an attachment is read once into a fixed JSON shape
              that the transcript keeps instead of the image.
            </P>
          </Section>

          <Section id="norba" title="Norba API">
            <P>
              All calls go to <C>{config.norba.baseUrl}</C> with <C>X-API-Key</C>. A <C>nbr_test_</C> key reaches the airlines&apos; sandboxes, a <C>nbr_live_</C> key production;
              without a key a local mock answers the same interface (<C>server/norba/mock.ts</C>).
            </P>
            <Table
              head={["Endpoint", "What for", "Called by"]}
              rows={[
                ["GET /v1/aviation/airports?q= · ?iata=", "City names to codes; names for every code shown", "find_airports, the chat's place names, MCP, the desk"],
                ["GET /v1/network/airlines", "Airlines a search reaches", "list_airlines"],
                ["GET /v1/offers/{id}/seats", "Seat map of a flight", "choose_seats"],
                ["GET /v1/offers/{id}/services", "Bags and extras for sale", "choose_extras"],
                ["GET /v1/orders/{id}", "An order read again after a change or a notice", "the guardian, get_order (MCP)"],
                ["GET /v1/shopping/calendar", "Cheapest fare per day", "price_calendar, MCP"],
                ["POST /v1/offers/price", "The airline confirms the price and holds it", "price_offer, Hold seats, Approve, create_checkout"],
                ["POST /v1/offers/quote", "The exact total with seats and extras", "review_price, every checkout link"],
                ["POST /v1/orders", "Book and pay (card), with an Idempotency-Key", "Pay in the chat, Pay on a checkout link"],
                ["POST /v1/orders/{id}/change/confirm", "Accept an alternative and reissue the order", "Switch"],
                ["POST /v1/orders/{id}/reshop", "Other flights for a booked one, with the difference to pay", "find_rebooking"],
                ["POST /v1/shopping/offers/stream", "Live offers, streamed airline by airline (SSE)", "search_flights, group agents, MCP, the desk"],
                ["Webhook order.schedule_changed", "The airline changed a booking on its own", "/api/webhooks/norba"],
              ]}
            />
          </Section>

          <Section id="routes" title="This app's routes">
            <Table
              head={["Route", "What it does"]}
              rows={[
                [<C key="0">GET /</C>, "The traveller's agent"],
                [<C key="1">GET /agency</C>, "The agency desk"],
                [<C key="2">GET /board?c=&lt;conversation&gt;&amp;status=CANCELLED</C>, "A departure board showing the booked flight, to photograph; in mock mode it also cancels the flight"],
                [<C key="3">GET /docs</C>, "This page"],
                [<C key="4">GET /pay/&lt;token&gt;</C>, "A checkout link: the flight, the exact total, the travellers' and card form"],
                [<C key="5">POST /api/agency/approve</C>, "Price an option of a draft and make its checkout link"],
                [<C key="6">POST /api/agency/draft</C>, "Draft a client request (NDJSON stream of steps, reading, options, reply)"],
                [<C key="7">POST /api/chat</C>, "One chat turn, form answer, attachment or notice (NDJSON stream)"],
                [<C key="8">POST /api/mcp</C>, "MCP server (JSON-RPC 2.0)"],
                [<C key="9">POST /api/pay/&lt;token&gt;</C>, "Pay a checkout link: details and card checked, then the airline books"],
                [<C key="10">POST /api/simulate</C>, "Mock only: the airline moves the latest booked flight and its notice arrives"],
                [<C key="11">GET /api/status</C>, "Which model and which Norba environment are in use"],
                [<C key="12">POST /api/transcribe</C>, "Dictation: WAV in, text out (Muse Voice Transcribe)"],
                [<C key="13">GET /api/updates?c=&amp;after=</C>, "What happened between messages: a group seat paid, an airline notice"],
                [<C key="14">POST /api/webhooks/norba</C>, "Norba webhooks, verified with X-Norba-Signature"],
              ]}
            />
          </Section>

          <Section id="tools" title="Agent tools">
            <P>The tools Muse Spark can call in the chat, with the Norba endpoint behind each.</P>
            <Table
              head={["Tool", "What it does", "Norba"]}
              rows={[
                ["ask_payment", "Card form with the reviewed total", "—"],
                ["ask_traveller_details", "Traveller and contact form", "—"],
                ["choose_extras", "Bags and extras with the fare", "GET /v1/offers/{id}/services"],
                ["choose_seats", "Seat map of every flight", "GET /v1/offers/{id}/seats"],
                ["find_airports", "City or airport name to IATA (International Air Transport Association) or metro code", "GET /v1/aviation/airports"],
                ["find_rebooking", "Other flights for a disrupted booking, each with a Switch button", "POST /v1/orders/{id}/reshop"],
                ["list_airlines", "Airlines a search reaches", "GET /v1/network/airlines"],
                ["plan_group_trip", "Agents per traveller and a coordinator", "POST /v1/shopping/offers/stream"],
                ["price_calendar", "Cheapest fare per day", "GET /v1/shopping/calendar"],
                ["price_offer", "Confirm the chosen offer's price", "POST /v1/offers/price"],
                ["refine_results", "Filter and re-sort the last search, without a new request", "—"],
                ["review_price", "The whole total, line by line", "POST /v1/offers/quote"],
                ["search_flights", "One-way, round-trip or multi-city search, streamed", "POST /v1/shopping/offers/stream"],
                ["skip_step", "Skip seats or extras", "—"],
                ["suggest_replies", "Tappable answers under the message", "—"],
              ]}
            />
            <P>
              Three actions are never given to the model; a person&apos;s press runs them: <C>book_trip</C> (Pay), <C>change_flight</C> (Switch) and <C>hold_group</C> (Hold seats for
              everyone).
            </P>
          </Section>

          <Section id="stream" title="Chat stream">
            <P>
              <C>POST /api/chat</C> takes <C>{"{ conversationId, message, form?, attachments?, context }"}</C> and answers one JSON event per line:
            </P>
            <Table
              head={["Event", "Meaning"]}
              rows={[
                ["block", "A card: offers, price, seats, extras, travellers, review, payment, booking, vision, rebook, group, notice"],
                ["done / error", "The turn ended, or why it failed"],
                ["notice", "An airline notice arrived (from /api/updates); the chat hands it to the agent"],
                ["offers_append / offers_final", "Offers as each airline answers, then the final list"],
                ["patch", "A card from an earlier message changed (a seat paid, a flight switched)"],
                ["places", "Airport and city names for every code shown"],
                ["start", "The conversation id and which model answers"],
                ["text", "The agent's words, as written"],
                ["tool", "A step the agent took: running, done or failed"],
                ["trip", "The twelve-step side panel"],
              ]}
            />
          </Section>

          <Section id="mcp" title="MCP server">
            <P>
              <C>/api/mcp</C> speaks MCP (Model Context Protocol) over Streamable HTTP: JSON-RPC 2.0 in a POST, one JSON answer out, the client&apos;s session in{" "}
              <C>Mcp-Session-Id</C>. Methods: <C>initialize</C>, <C>tools/list</C>, <C>tools/call</C>, <C>ping</C>. With <C>MCP_TOKEN</C> set it asks for{" "}
              <C>Authorization: Bearer</C>.
            </P>
            <Table
              head={["Tool", "What it does"]}
              rows={[
                ["create_checkout", "Prices an offer with the airline and returns a checkout link the traveller books on"],
                ["find_airports", "City or airport name to codes"],
                ["get_order", "Status, flights and tickets of a booking made through a link"],
                ["price_calendar", "Cheapest fare per day on a route"],
                ["search_flights", "Live offers with refs and structured results"],
              ]}
            />
            <Code label="A session">{MCP_CALLS}</Code>
            <Code label="Try it">{`node scripts/any-assistant.mjs "Book me a non-stop from Madrid to Athens on 11 December"
# a terminal assistant on Muse Spark that knows nothing about flights: it lists Norba's MCP tools and uses them`}</Code>
          </Section>

          <Section id="flows" title="Flows">
            <Table
              head={["Flow", "Steps"]}
              rows={[
                ["Agency desk", "Request read (Muse Spark Open) → Norba searches the cabin asked for and economy → each option checked against the policy → reply drafted → Approve prices it and adds a checkout link"],
                ["Board photo", "Photo → Muse Spark reads every row → the traveller's flight found by number → disrupted → find_rebooking → Switch"],
                ["Booking", "Request → airports → search → choose → price → seats → extras → travellers → review → payment → booking → e-tickets"],
                ["Document to trip", "File → Muse Spark reads it (kind, facts with boxes, trip) → the agent asks only what is missing → search"],
                ["Group trip", "Cities resolved → one search and one Muse Spark shortlist per traveller, in parallel → the coordinator picks → code checks → Hold → a link each → payments reach the chat"],
                ["Guardian", "order.schedule_changed (signed webhook, or simulated) → the conversation that booked it → the agent explains and calls find_rebooking → Switch"],
              ]}
            />
          </Section>

          <Section id="safety" title="Safety and privacy">
            <Table
              head={["Rule", "How"]}
              rows={[
                ["Assistants never hold a card", "MCP and group trips hand out checkout links; the traveller types names and card on the page"],
                ["Files stay out of the transcript", "Read once by Muse Spark into JSON; the transcript keeps the reading, not the image"],
                ["No double booking", "One Idempotency-Key per booking attempt and per switch, reused on retries"],
                ["No personal data to the model", "Traveller and card forms post to this server only; the model reads first names and a card's last four digits"],
                ["Only a person spends money", "Pay, Switch and Hold run actions the model is not given"],
                ["Spending has a ceiling", "Requests per visitor per hour on every route that reaches a model or Norba, and a daily cap on model calls"],
                ["The card lives one request", "Wiped after the booking attempt, whatever the outcome; never logged"],
                ["Webhooks are verified", "X-Norba-Signature: HMAC-SHA256 of t.body with the endpoint secret, stale timestamps refused, nothing accepted without the secret"],
              ]}
            />
          </Section>

          <Section id="config" title="Configuration">
            <Table
              head={["Variable", "Default", "What it sets"]}
              rows={[
                ["ALLOW_PRODUCTION_BOOKINGS", "false", "With a nbr_live_ key, real bookings stay off unless true"],
                ["MAX_MODEL_CALLS_PER_DAY", "1500", "Meta model calls per day for the whole app; 0 turns the cap off"],
                ["MAX_REQUESTS_PER_VISITOR_PER_HOUR", "60", "Per visitor and route: chat, voice, desk, MCP, checkout"],
                ["MCP_TOKEN", "empty (open)", "Bearer token for /api/mcp"],
                ["MODEL_API_KEY", "empty", "Meta Model API key; empty runs the offline planner"],
                ["MODEL_BASE_URL", "https://api.meta.ai/v1", "Chat Completions base URL"],
                ["MODEL_ID", "muse-spark-1.3", "The agent's model"],
                ["MODEL_PLANNER_EFFORT", "high", "The group coordinator's reasoning effort"],
                ["MODEL_REASONING_EFFORT", "low", "The chat's reasoning effort"],
                ["NORBA_API_KEY", "empty (mock)", "nbr_test_… sandbox, nbr_live_… production"],
                ["NORBA_API_URL", "https://api.norba.io", "Norba base URL"],
                ["NORBA_WEBHOOK_SECRET", "empty", "whsec_ secret for /api/webhooks/norba"],
                ["OPEN_MODEL_API_KEY", "empty", "Partner key for Muse Spark Open (the desk)"],
                ["OPEN_MODEL_BASE_URL", "https://inference.baseten.co/v1", "Partner base URL"],
                ["OPEN_MODEL_ID", "meta-models/muse-spark-open-1026", "Open-weight model id"],
                ["PUBLIC_URL", "the request's host", "Base of checkout links"],
                ["VOICE_MODEL_ID", "muse-voice-transcribe-1.0", "Dictation model"],
              ]}
            />
          </Section>

          <Section id="modes" title="Run modes">
            <Code>{`npm install
cp .env.example .env.local
npm run dev        # http://localhost:3200`}</Code>
            <Table
              head={["MODEL_API_KEY", "NORBA_API_KEY", "What you get"]}
              rows={[
                ["empty", "empty", "Offline planner on mock flights: the whole booking, rebooking and notices, nothing leaves the machine. Card 4242 4242 4242 4242 books, 4000 0000 0000 0002 is declined."],
                ["set", "empty", "Every Meta feature on mock flights; nothing metered on Norba"],
                ["set", "nbr_test_…", "Muse Spark on the airlines' sandboxes"],
              ]}
            />
          </Section>

        </main>
      </div>
      <AppFooter />
    </div>
  );
}
