"use client";

import { Callout, layout, Paths, range, Scene, Sheet, type Kind, type V3 } from "./iso";

/**
 * The docs page's architecture, as a small campus on drawing paper. The agent's building stands in the middle. The
 * traveller's laptop sends it a chat turn and gets its events back. Two masts on its roof reach the Meta towers
 * behind: Muse Spark for the chat, Muse Spark Open for the agency desk. Norba's building stands to its right and
 * relays to the airlines' stands, and it sends the airline's schedule changes back as webhooks. The agency desk and
 * other AI assistants (over MCP) come in from the front. Red marks a chat turn's path; the other wires are in ink.
 */

const W = 760;
const H = 430;

/** `u` runs along the sheet to the right, `v` towards the viewer, in metres; larger `u` or `v` stands nearer. */
const TURN = (18 * Math.PI) / 180;
const [C, S] = [Math.cos(TURN), Math.sin(TURN)];
const P = (u: number, v: number, z: number): V3 => [u * C + v * S, v * C - u * S, z];
const ALONG: V3 = [C, -S, 0];
const UP_DOWN: V3 = [0, 0, -1];

function lbox(scene: Scene, u0: number, v0: number, z0: number, u1: number, v1: number, z1: number, kind?: Kind) {
  scene.orientedBox(P(u0, v0, z0), [(u1 - u0) * C, -(u1 - u0) * S, 0], [(v1 - v0) * S, (v1 - v0) * C, 0], z1 - z0, kind);
}

const ground = (pts: [number, number][]): V3[] => pts.map(([u, v]) => P(u, v, 0));
const corners = (b: Block, z: number): V3[] => [P(b.u0, b.v0, z), P(b.u1, b.v0, z), P(b.u1, b.v1, z), P(b.u0, b.v1, z)];
/** A track a metre and a bit wide under a wire, from `a` to `b` along `u` or `v`. */
const track = (a: [number, number], b: [number, number], half = 0.7): V3[] =>
  a[1] === b[1]
    ? ground([[a[0], a[1] - half], [b[0], b[1] - half], [b[0], b[1] + half], [a[0], a[1] + half]])
    : ground([[a[0] - half, a[1]], [a[0] + half, a[1]], [b[0] + half, b[1]], [b[0] - half, b[1]]]);

type Block = { u0: number; u1: number; v0: number; v1: number; z: number };

const META: Block = { u0: -10, u1: -3, v0: -18, v1: -12, z: 13 };
const OPEN: Block = { u0: 2, u1: 7, v0: -17, v1: -12.5, z: 9 };
const LAPTOP: Block = { u0: -26, u1: -18, v0: -2.6, v1: 2.6, z: 1.4 };
const AGENT: Block = { u0: -9, u1: 0, v0: -3.5, v1: 3.5, z: 6 };
const NORBA: Block = { u0: 9, u1: 15, v0: -3, v1: 3, z: 5 };
const AGENCY: Block = { u0: -17, u1: -10, v0: 10, v1: 14, z: 3.6 };
const MCP: Block = { u0: -3.5, u1: 6, v0: 8.5, v1: 11.5, z: 1 };

/** The masts on the agent's roof, and the airlines' branches out of Norba. */
const MAST_META = { u: -6, v: -1.2, z: 8.6 };
const MAST_OPEN = { u: -2, v: -1.2, z: 8 };
const SPLIT = [15, 18];
const END_U = 23.5;
const LINES = [
  { code: "AA", v: -4.5 },
  { code: "A3", v: 4.5 },
];

/** Where the wires run on the ground. */
const TURN_V = 0;
const EVENTS_V = 1.7;
const WEBHOOK_V = 1.7;
const AGENCY_U = -6.5;
const MCP_U = -1.6;

const DRAWING = (() => {
  const scene = new Scene();

  /* Ground: shadows, then the tracks the wires run on. */
  scene.pass = 0;
  scene.framing = false;
  for (const b of [META, OPEN, AGENT, NORBA, AGENCY]) scene.shadow([...corners(b, 0), ...corners(b, b.z)]);
  scene.shadow([...corners(LAPTOP, 0), ...corners(LAPTOP, LAPTOP.z), P(-24, -1.6, 4.6), P(-20, -1.6, 4.6)]);
  scene.line([...ground([[-29, -21], [30, -21], [30, 15], [-29, 15]]), P(-29, -21, 0)], "dash");
  scene.framing = true;
  scene.face(track([LAPTOP.u1, TURN_V + 0.85], [AGENT.u0, TURN_V + 0.85], 1.6), "well");
  scene.face(track([AGENT.u1, TURN_V + 0.85], [NORBA.u0, TURN_V + 0.85], 1.6), "well");
  scene.face(track([NORBA.u1, 0], [SPLIT[0], 0]), "well");
  LINES.forEach(({ v }) => {
    scene.face(ground([[SPLIT[0], -0.7], [SPLIT[1], v - 0.7], [SPLIT[1], v + 0.7], [SPLIT[0], 0.7]]), "well");
    scene.face(track([SPLIT[1], v], [END_U, v]), "well");
  });
  scene.face(ground([[AGENCY.u1, 11.3], [AGENCY_U + 0.7, 11.3], [AGENCY_U + 0.7, AGENT.v1], [AGENCY_U - 0.7, AGENT.v1], [AGENCY_U - 0.7, 12.7], [AGENCY.u1, 12.7]]), "well");
  scene.face(track([MCP_U, AGENT.v1], [MCP_U, MCP.v0]), "well");

  /* The Meta towers at the back: Muse Spark, and Muse Spark Open beside it. */
  scene.pass = 1;
  lbox(scene, META.u0, META.v0, 0, META.u1, META.v1, META.z);
  scene.lines(range(1, META.z - 4, 7).map((z) => [P(META.u0 + 0.6, META.v1, z), P(META.u1 - 0.6, META.v1, z)]), "hair");
  scene.lines(range(META.v0 + 0.8, META.v1 - 0.8, 5).map((v) => [P(META.u1, v, 0.8), P(META.u1, v, META.z - 0.8)]), "hair");
  lbox(scene, OPEN.u0, OPEN.v0, 0, OPEN.u1, OPEN.v1, OPEN.z);
  scene.lines(range(1, OPEN.z - 3, 5).map((z) => [P(OPEN.u0 + 0.6, OPEN.v1, z), P(OPEN.u1 - 0.6, OPEN.v1, z)]), "hair");

  /* The traveller's laptop on its plinth, a conversation on the screen. */
  scene.pass = 2;
  lbox(scene, LAPTOP.u0, LAPTOP.v0, 0, LAPTOP.u1, LAPTOP.v1, LAPTOP.z);
  lbox(scene, -24.2, -1.4, LAPTOP.z, -19.8, 1.4, LAPTOP.z + 0.25);
  lbox(scene, -24.2, -1.6, LAPTOP.z, -19.8, -1.4, LAPTOP.z + 3.2);
  scene.face([P(-23.8, -1.4, 2), P(-20.2, -1.4, 2), P(-20.2, -1.4, 4.3), P(-23.8, -1.4, 4.3)], "well");
  scene.fills([
    [P(-23.5, -1.39, 3.6), P(-21.6, -1.39, 3.6), P(-21.6, -1.39, 4), P(-23.5, -1.39, 4)],
    [P(-22.4, -1.39, 2.8), P(-20.5, -1.39, 2.8), P(-20.5, -1.39, 3.2), P(-22.4, -1.39, 3.2)],
  ], "mark");
  scene.lines(range(-23.8, -20.4, 6).map((u) => [P(u, -0.9, LAPTOP.z + 0.26), P(u, 0.9, LAPTOP.z + 0.26)]), "hair");

  /* The agent's building: glazing on its front and side, the two masts on its roof. */
  scene.pass = 3;
  lbox(scene, AGENT.u0, AGENT.v0, 0, AGENT.u1, AGENT.v1, AGENT.z);
  scene.lines(range(AGENT.u0 + 0.8, AGENT.u1 - 0.8, 9).map((u) => [P(u, AGENT.v1, 0.6), P(u, AGENT.v1, AGENT.z - 2.2)]), "hair");
  scene.line([P(AGENT.u0 + 0.5, AGENT.v1, AGENT.z - 1.8), P(AGENT.u1 - 0.5, AGENT.v1, AGENT.z - 1.8)], "fine");
  scene.lines(range(AGENT.v0 + 0.8, AGENT.v1 - 0.8, 6).map((v) => [P(AGENT.u1, v, 0.6), P(AGENT.u1, v, AGENT.z - 0.6)]), "hair");
  for (const m of [MAST_META, MAST_OPEN]) {
    lbox(scene, m.u - 0.18, m.v - 0.18, AGENT.z, m.u + 0.18, m.v + 0.18, m.z);
    scene.face(range(0, 2 * Math.PI, 16).map((t) => P(m.u + 0.55 * Math.cos(t), m.v + 0.55 * Math.sin(t), m.z)));
  }

  /* Norba's building and the airlines' stands: a plain tail fin on a plinth, the code on the plinth. */
  scene.pass = 4;
  lbox(scene, NORBA.u0, NORBA.v0, 0, NORBA.u1, NORBA.v1, NORBA.z);
  scene.lines(range(NORBA.v0 + 0.8, NORBA.v1 - 0.8, 7).map((v) => [P(NORBA.u1, v, 0.6), P(NORBA.u1, v, NORBA.z - 0.6)]), "hair");
  scene.line([P(NORBA.u0 + 0.5, NORBA.v1, 1.2), P(NORBA.u1 - 0.5, NORBA.v1, 1.2)], "fine");
  LINES.forEach(({ v }, i) => {
    scene.pass = 5 + i;
    scene.framing = false;
    scene.shadow([P(END_U, v - 1.6, 0), P(END_U + 4, v + 1.6, 0), P(END_U + 2, v - 0.25, 6), P(END_U + 3.4, v + 0.25, 6)]);
    scene.framing = true;
    lbox(scene, END_U, v - 1.6, 0, END_U + 4, v + 1.6, 1.1);
    const fin = (w: number) => [P(END_U + 0.4, w, 1.1), P(END_U + 3.6, w, 1.1), P(END_U + 2.9, w, 6.6), P(END_U + 1.5, w, 6.6)];
    const [b, f] = [fin(v - 0.25), fin(v + 0.25)];
    scene.face([b[1], b[2], f[2], f[1]]);
    scene.face([b[2], b[3], f[3], f[2]]);
    scene.face(f);
  });

  /* In front: the agency's office, and other AI assistants on a plinth. */
  scene.pass = 7;
  lbox(scene, AGENCY.u0, AGENCY.v0, 0, AGENCY.u1, AGENCY.v1, AGENCY.z);
  scene.lines(range(AGENCY.u0 + 0.7, AGENCY.u1 - 0.7, 7).map((u) => [P(u, AGENCY.v1, 0.5), P(u, AGENCY.v1, 1.9)]), "hair");
  lbox(scene, AGENCY.u0 - 0.3, AGENCY.v0 - 0.3, AGENCY.z, AGENCY.u1 + 0.3, AGENCY.v1 + 0.3, AGENCY.z + 0.3);
  scene.pass = 8;
  lbox(scene, MCP.u0, MCP.v0, 0, MCP.u1, MCP.v1, MCP.z);
  lbox(scene, -2.4, 9.2, MCP.z, -0.4, 10.8, MCP.z + 2.2);
  {
    const c = P(2.2, 10, 0);
    scene.vcyl(c[0], c[1], 1, MCP.z, MCP.z + 1.8);
  }
  lbox(scene, 3.8, 9.3, MCP.z, 5.3, 10.7, MCP.z + 2.8);

  const L = layout(scene, W, H, { l: 120, r: 150, t: 70, b: 86 });
  // A phone hides the callouts, so its crop takes in the whole campus and nothing else.
  return { L, phone: "120 40 490 370" };
})();

export function ArchitectureDrawing() {
  const { L, phone } = DRAWING;
  const { at, plane, K } = L;
  const pts = (list: V3[]) => list.map((p) => at(p).join(",")).join(" ");
  const wire = { fill: "none", strokeWidth: 1.3, strokeDasharray: "5 3", strokeLinejoin: "round" as const, className: "fx-wire" };
  const g = (u: number, v: number) => P(u, v, 0.05);

  return (
    <Sheet code="A-01" title="One chat turn, end to end" W={W} H={H} phone={phone}>
      <Paths list={L.paths} />

      {/* A chat turn in red: laptop to agent, up to Muse Spark, across to Norba and out to every airline. */}
      <g className="fx-fade" style={{ animationDelay: "1100ms" }}>
        <polyline points={pts([g(LAPTOP.u1, TURN_V), g(AGENT.u0, TURN_V)])} stroke="var(--hr-rust)" {...wire} />
        <polyline points={pts([P(MAST_META.u, MAST_META.v, MAST_META.z), P(-6.5, META.v1, 10.5)])} stroke="var(--hr-rust)" {...wire} />
        <polyline points={pts([g(AGENT.u1, TURN_V), g(NORBA.u0, TURN_V)])} stroke="var(--hr-rust)" {...wire} />
        {LINES.map(({ code, v }) => (
          <polyline key={code} points={pts([g(NORBA.u1, 0), g(SPLIT[0], 0), g(SPLIT[1], v), g(END_U, v)])} stroke="var(--hr-rust)" {...wire} />
        ))}
      </g>

      {/* The other wires in ink: events back, the agency desk's model, webhooks, the agency and the assistants. */}
      <g className="fx-fade" style={{ animationDelay: "1250ms" }}>
        <polyline points={pts([g(AGENT.u0, EVENTS_V), g(LAPTOP.u1, EVENTS_V)])} stroke="var(--hr-ink-strong)" {...wire} strokeWidth={0.9} />
        <polyline points={pts([P(MAST_OPEN.u, MAST_OPEN.v, MAST_OPEN.z), P(4.5, OPEN.v1, 6.5)])} stroke="var(--hr-ink-strong)" {...wire} strokeWidth={0.9} />
        <polyline points={pts([g(NORBA.u0, WEBHOOK_V), g(AGENT.u1, WEBHOOK_V)])} stroke="var(--hr-ink-strong)" {...wire} strokeWidth={0.9} />
        <polyline points={pts([g(AGENCY.u1, 12), g(AGENCY_U, 12), g(AGENCY_U, AGENT.v1)])} stroke="var(--hr-ink-strong)" {...wire} strokeWidth={0.9} />
        <polyline points={pts([g(MCP_U, MCP.v0), g(MCP_U, AGENT.v1)])} stroke="var(--hr-ink-strong)" {...wire} strokeWidth={0.9} />
      </g>

      {/* Names on the fronts, codes on the plinths. */}
      <g className="fx-fade font-mono" style={{ animationDelay: "900ms" }}>
        <text transform={plane(P(META.u0 + 0.7, META.v1, META.z - 1.4), ALONG, UP_DOWN)} fontSize={1.5 * K} letterSpacing="0.08em" fill="var(--hr-ink-strong)">
          META
        </text>
        <text transform={plane(P(META.u0 + 0.7, META.v1, META.z - 2.7), ALONG, UP_DOWN)} fontSize={0.62 * K} letterSpacing="0.06em" fill="var(--hr-ink-strong)">
          MUSE SPARK
        </text>
        <text transform={plane(P(OPEN.u0 + 0.6, OPEN.v1, OPEN.z - 1.3), ALONG, UP_DOWN)} fontSize={0.62 * K} letterSpacing="0.06em" fill="var(--hr-ink-strong)">
          SPARK OPEN
        </text>
        <text transform={plane(P(AGENT.u0 + 0.6, AGENT.v1, AGENT.z - 0.55), ALONG, UP_DOWN)} fontSize={1.05 * K} letterSpacing="0.08em" fill="var(--hr-ink-strong)">
          AGENT
        </text>
        <text transform={plane(P(NORBA.u0 + 0.6, NORBA.v1, NORBA.z - 1.1), ALONG, UP_DOWN)} fontSize={1.05 * K} letterSpacing="0.08em" fill="var(--hr-ink-strong)">
          NORBA
        </text>
        <text transform={plane(P(LAPTOP.u0 + 0.6, LAPTOP.v1, 1.05), ALONG, UP_DOWN)} fontSize={0.75 * K} letterSpacing="0.06em" fill="var(--hr-ink-strong)">
          TRAVELLER
        </text>
        <text transform={plane(P(AGENCY.u0 + 0.6, AGENCY.v1, AGENCY.z - 1.1), ALONG, UP_DOWN)} fontSize={0.9 * K} letterSpacing="0.08em" fill="var(--hr-ink-strong)">
          AGENCY
        </text>
        <text transform={plane(P(MCP.u0 + 0.5, MCP.v1, MCP.z - 0.22), ALONG, UP_DOWN)} fontSize={0.65 * K} letterSpacing="0.08em" fill="var(--hr-ink-strong)">
          MCP
        </text>
        {LINES.map(({ code, v }) => (
          <text key={code} transform={plane(P(END_U + 1.2, v + 1.6, 0.9), ALONG, UP_DOWN)} fontSize={0.8 * K} letterSpacing="0.08em" fill="var(--hr-ink-strong)">
            {code}
          </text>
        ))}
      </g>

      <Callout at={at(g(-13, TURN_V))} off={[-60, -128]} side="left" title="A chat turn" chip={{ code: "POST", text: "/api/chat · NDJSON back" }} red delay={1400} />
      <Callout at={at(P(META.u0, META.v1, META.z - 3))} off={[-40, -58]} side="left" title="Muse Spark" sub="Tools, vision, structured output" delay={1500} />
      <Callout at={at(P(OPEN.u1, OPEN.v1, OPEN.z - 2))} off={[60, -26]} side="right" title="Muse Spark Open" sub="Baseten · the agency desk" delay={1550} />
      <Callout at={at(g(4.5, WEBHOOK_V))} off={[0, 112]} side="right" title="Airline changes" chip={{ code: "order.schedule_changed", text: "webhook" }} delay={1600} />
      <Callout at={at(P(END_U + 2.2, LINES[0].v, 6))} off={[30, -30]} side="right" title="The airlines" sub="Norba API · NDC" red delay={1650} />
      <Callout at={at(P(1, MCP.v1, MCP.z))} off={[-30, 44]} side="left" title="Any AI assistant" chip={{ code: "MCP", text: "/api/mcp · checkout links" }} delay={1700} />
      <Callout at={at(P(AGENCY.u0, AGENCY.v1, AGENCY.z / 2))} off={[-36, -30]} side="left" title="Agency desk" sub="/agency" delay={1750} />
    </Sheet>
  );
}
