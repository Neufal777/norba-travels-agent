"use client";

import { layout, Paths, range, Scene, Sheet, type V3 } from "./iso";
import { Badge, Legend, Tag } from "./kit";
import { ALONG, finStand, ground, lbox, P, panel, UP_DOWN } from "./turned";

/**
 * Any file becomes a trip. A wedding invitation stands on an easel with the facts Muse Spark found boxed in red and
 * its scan line across it; the reading goes to Muse Spark's tower, comes out as the trip's card (destination, date,
 * travellers), and the agent searches the airlines with it.
 */

const W = 960;
const H = 480;

const CARD = { u0: -21, u1: -9, v: -0.9, z0: 1.5, z1: 12.5 };
const MUSE = { u0: -4, u1: 2, v0: -3, v1: 3, z: 8 };
const TRIP = { u0: 6, u1: 15.5, v: -0.9, z0: 1.5, z1: 10.5 };
const FIN_U = 20.5;

/** The facts boxed on the invitation, by the lines they sit on. */
const BOXES = [
  { u0: -20.4, u1: -11.6, z0: 6.05, z1: 7.15 },
  { u0: -20.4, u1: -11.3, z0: 4.55, z1: 5.45 },
  { u0: -20.4, u1: -13.3, z0: 9.35, z1: 10.45 },
];

const DRAWING = (() => {
  const scene = new Scene();

  scene.pass = 0;
  scene.framing = false;
  scene.shadow([...panel(CARD.u0, CARD.u1, CARD.v, 0, 0), ...panel(CARD.u0, CARD.u1, CARD.v, CARD.z1, CARD.z1)]);
  scene.shadow([...ground([[MUSE.u0, MUSE.v0], [MUSE.u1, MUSE.v0], [MUSE.u1, MUSE.v1], [MUSE.u0, MUSE.v1]]), P(MUSE.u0, MUSE.v0, MUSE.z), P(MUSE.u1, MUSE.v1, MUSE.z)]);
  scene.shadow([...panel(TRIP.u0, TRIP.u1, TRIP.v, 0, 0), ...panel(TRIP.u0, TRIP.u1, TRIP.v, TRIP.z1, TRIP.z1)]);
  scene.line([...ground([[-25, -8], [27, -8], [27, 7], [-25, 7]]), P(-25, -8, 0)], "dash");
  scene.framing = true;
  scene.face(ground([[CARD.u1 + 0.5, -0.7], [MUSE.u0, -0.7], [MUSE.u0, 0.7], [CARD.u1 + 0.5, 0.7]]), "well");
  scene.face(ground([[MUSE.u1, -0.7], [TRIP.u0 - 0.5, -0.7], [TRIP.u0 - 0.5, 0.7], [MUSE.u1, 0.7]]), "well");
  scene.face(ground([[TRIP.u1 + 0.5, -0.7], [FIN_U, -0.7], [FIN_U, 0.7], [TRIP.u1 + 0.5, 0.7]]), "well");

  /* The invitation on its stand, with its lines of type as hairlines under the text. */
  scene.pass = 1;
  lbox(scene, CARD.u0 - 0.5, -1.8, 0, CARD.u1 + 0.5, 0.4, CARD.z0);
  lbox(scene, CARD.u0, CARD.v - 0.3, CARD.z0, CARD.u1, CARD.v, CARD.z1);
  scene.line([P(CARD.u0 + 0.4, CARD.v + 0.01, CARD.z1 - 0.4), P(CARD.u1 - 0.4, CARD.v + 0.01, CARD.z1 - 0.4), P(CARD.u1 - 0.4, CARD.v + 0.01, CARD.z0 + 0.4), P(CARD.u0 + 0.4, CARD.v + 0.01, CARD.z0 + 0.4), P(CARD.u0 + 0.4, CARD.v + 0.01, CARD.z1 - 0.4)], "hair");

  /* Muse Spark's tower. */
  scene.pass = 2;
  lbox(scene, MUSE.u0, MUSE.v0, 0, MUSE.u1, MUSE.v1, MUSE.z);
  scene.lines(range(1, MUSE.z - 2, 6).map((z) => [P(MUSE.u0 + 0.5, MUSE.v1, z), P(MUSE.u1 - 0.5, MUSE.v1, z)]), "hair");
  scene.lines(range(MUSE.v0 + 0.7, MUSE.v1 - 0.7, 5).map((v) => [P(MUSE.u1, v, 0.7), P(MUSE.u1, v, MUSE.z - 0.7)]), "hair");

  /* The trip's card on its stand. */
  scene.pass = 3;
  lbox(scene, TRIP.u0 - 0.5, -1.8, 0, TRIP.u1 + 0.5, 0.4, TRIP.z0);
  lbox(scene, TRIP.u0, TRIP.v - 0.3, TRIP.z0, TRIP.u1, TRIP.v, TRIP.z1);
  scene.lines([8.2, 6.6, 5, 3.4].map((z) => [P(TRIP.u0 + 0.5, TRIP.v + 0.01, z - 0.45), P(TRIP.u1 - 0.5, TRIP.v + 0.01, z - 0.45)]), "hair");

  /* An airline's stand. */
  scene.pass = 4;
  finStand(scene, FIN_U, 0);

  const L = layout(scene, W, H, { l: 30, r: 330, t: 92, b: 70 });
  return { L };
})();

const ROWS = [
  { n: "1", title: "Drop any file", sub: "A photo, a PDF or a chat screenshot" },
  { n: "2", title: "Muse Spark reads it", sub: "Every fact boxed on the image" },
  { n: "3", title: "The facts become the trip", sub: "Place, date, travellers — checked" },
  { n: "4", title: "The agent searches", sub: "Every airline, live, through Norba" },
];

export function VisionDrawing() {
  const { at, plane, K, paths } = DRAWING.L;
  const pts = (list: V3[]) => list.map((p) => at(p).map((n) => n.toFixed(1)).join(",")).join(" ");
  const wire = { fill: "none", stroke: "var(--hr-rust)", strokeWidth: 1.4, strokeDasharray: "5 3", className: "fx-wire" };
  const step = (i: number) => 1500 + i * 260;
  const onCard = (u: number, z: number) => plane(P(u, CARD.v + 0.02, z), ALONG, UP_DOWN);
  const onTrip = (u: number, z: number) => plane(P(u, TRIP.v + 0.02, z), ALONG, UP_DOWN);
  const ink = "var(--hr-ink-strong)";

  return (
    <Sheet code="V-02" title="Any file becomes a trip" W={W} H={H}>
      <Paths list={paths} />

      {/* The invitation's type, and the trip card's rows. */}
      <g className="fx-fade font-mono" style={{ animationDelay: "800ms" }} fill={ink}>
        <text transform={onCard(-20.2, 11.3)} fontSize={0.5 * K} letterSpacing="0.12em" opacity={0.7}>
          YOU ARE INVITED
        </text>
        <text transform={onCard(-20.2, 9.6)} fontSize={0.95 * K}>
          ANA &amp; DAVID
        </text>
        <text transform={onCard(-20.2, 8.4)} fontSize={0.55 * K} opacity={0.8}>
          are getting married
        </text>
        <text transform={onCard(-20.2, 6.35)} fontSize={0.85 * K}>
          12 DECEMBER 2026
        </text>
        <text transform={onCard(-20.2, 4.8)} fontSize={0.6 * K}>
          THE BOATHOUSE · NEW YORK
        </text>
        <text transform={onCard(-20.2, 2.6)} fontSize={0.45 * K} opacity={0.7}>
          RSVP BY 1 NOVEMBER
        </text>
        <text transform={onTrip(TRIP.u0 + 0.5, 9.4)} fontSize={0.55 * K} letterSpacing="0.1em" fill="var(--hr-rust)">
          THE TRIP
        </text>
        {[
          ["TO", "NEW YORK (NYC)", 8.2],
          ["ARRIVE BY", "12 DEC 2026", 6.6],
          ["TRAVELLERS", "2 ADULTS", 5],
          ["FROM", "MADRID (MAD)", 3.4],
        ].map(([k, val, z]) => (
          <g key={k as string}>
            <text transform={onTrip(TRIP.u0 + 0.5, z as number)} fontSize={0.42 * K} opacity={0.6}>
              {k}
            </text>
            <text transform={onTrip(TRIP.u0 + 4.3, z as number)} fontSize={0.48 * K}>
              {val}
            </text>
          </g>
        ))}
      </g>

      {/* What Muse Spark found, boxed, and its scan line. */}
      <g className="fx-fade" style={{ animationDelay: `${step(1)}ms` }}>
        {BOXES.map((b, i) => (
          <polyline
            key={i}
            points={pts([P(b.u0, CARD.v + 0.03, b.z0), P(b.u1, CARD.v + 0.03, b.z0), P(b.u1, CARD.v + 0.03, b.z1), P(b.u0, CARD.v + 0.03, b.z1), P(b.u0, CARD.v + 0.03, b.z0)])}
            fill="none"
            stroke="var(--hr-rust)"
            strokeWidth={1.4}
          />
        ))}
        <polyline points={pts([P(CARD.u0, CARD.v + 0.03, 7.9), P(CARD.u1, CARD.v + 0.03, 7.9)])} {...wire} strokeDasharray="2 2" />
      </g>

      {/* The reading's path: to Muse Spark, out as the trip, on to the airlines. */}
      <g className="fx-fade" style={{ animationDelay: "1100ms" }}>
        <polyline points={pts([P(CARD.u1 + 0.5, 0, 0.05), P(MUSE.u0, 0, 0.05)])} {...wire} />
        <polyline points={pts([P(MUSE.u1, 0, 0.05), P(TRIP.u0 - 0.5, 0, 0.05)])} {...wire} />
        <polyline points={pts([P(TRIP.u1 + 0.5, 0, 0.05), P(FIN_U, 0, 0.05)])} {...wire} />
      </g>

      <Tag at={at(P(-15, CARD.v, CARD.z1))} off={[40, -44]} title="invitation.jpg" sub="Dropped into the chat" />
      <Tag at={at(P(-1, 0, MUSE.z))} off={[0, -60]} title="Muse Spark" sub="Vision · structured output" />
      <Tag at={at(P(10.75, TRIP.v, TRIP.z1))} off={[10, -40]} title="The trip" sub="What the agent books from" made />
      <Tag at={at(P(FIN_U + 2.2, 0, 6.6))} off={[24, -44]} title="Airlines" sub="Searched live" />

      <Badge at={at(P(CARD.u0, CARD.v, CARD.z1))} n="1" delay={step(0)} />
      <Badge at={at(P(CARD.u1, CARD.v, 7.9))} n="2" delay={step(1)} />
      <Badge at={at(P(TRIP.u0, TRIP.v, TRIP.z1))} n="3" delay={step(2)} />
      <Badge at={at(P(18, 0, 0.05))} n="4" delay={step(3)} />

      <Legend x={W - 304} y={64} w={280} heading="From a file to a trip" rows={ROWS} delay={step} row={40} />
    </Sheet>
  );
}
