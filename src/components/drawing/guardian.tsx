"use client";

import { layout, Paths, range, Scene, Sheet, type V3 } from "./iso";
import { Badge, Legend, Tag } from "./kit";
import { ALONG, finStand, ground, lbox, P, panel, UP_DOWN } from "./turned";

/**
 * A guardian after booking. At the back an airline moves a flight and Norba's webhook reaches the agent; in front a
 * departure board says CANCELLED and the traveller's phone photographs it, the row boxed in red as Muse Spark reads
 * it. Either way the agent answers with better flights on a card whose red Switch changes the booking.
 */

const W = 960;
const H = 500;

const BOARD = { u0: -25, u1: -8, v: -2, z0: 3, z1: 11 };
const PHONE = { u0: -17, u1: -14.2, v: 5, z0: 3.2, z1: 8.4 };
const AGENT = { u0: -1, u1: 5, v0: -3, v1: 3, z: 6 };
const NORBA = { u0: -1, u1: 4, v0: -17, v1: -13, z: 4.5 };
const FIN = { u: 8, v: -15 };
const CARD = { u0: 9, u1: 18.5, v: 1, z0: 1.5, z1: 10.5 };

/** The board's rows: flight, destination, time, status. */
const ROWS_ON_BOARD = [
  ["A3 601", "ATHENS", "10:40", "BOARDING"],
  ["AA 37", "NEW YORK", "11:15", "CANCELLED"],
  ["IB 3150", "LISBON", "11:30", "ON TIME"],
];

const DRAWING = (() => {
  const scene = new Scene();

  scene.pass = 0;
  scene.framing = false;
  scene.line([...ground([[-28, -20], [22, -20], [22, 9], [-28, 9]]), P(-28, -20, 0)], "dash");
  scene.shadow([...panel(BOARD.u0, BOARD.u1, BOARD.v, 0, 0), ...panel(BOARD.u0, BOARD.u1, BOARD.v, BOARD.z1, BOARD.z1)]);
  scene.shadow([...ground([[AGENT.u0, AGENT.v0], [AGENT.u1, AGENT.v0], [AGENT.u1, AGENT.v1], [AGENT.u0, AGENT.v1]]), P(AGENT.u0, AGENT.v0, AGENT.z), P(AGENT.u1, AGENT.v1, AGENT.z)]);
  scene.shadow([...ground([[NORBA.u0, NORBA.v0], [NORBA.u1, NORBA.v1]]), P(NORBA.u0, NORBA.v1, NORBA.z), P(NORBA.u1, NORBA.v0, NORBA.z)]);
  scene.shadow([...panel(CARD.u0, CARD.u1, CARD.v, 0, 0), ...panel(CARD.u0, CARD.u1, CARD.v, CARD.z1, CARD.z1)]);
  scene.framing = true;
  scene.face(ground([[FIN.u, FIN.v - 0.7], [NORBA.u1, FIN.v - 0.7], [NORBA.u1, FIN.v + 0.7], [FIN.u, FIN.v + 0.7]]), "well");
  scene.face(ground([[1.5 - 0.7, NORBA.v1], [1.5 + 0.7, NORBA.v1], [1.5 + 0.7, AGENT.v0], [1.5 - 0.7, AGENT.v0]]), "well");
  scene.face(ground([[-14.2, 4.3], [1.3, 4.3], [1.3, AGENT.v1], [2.7, AGENT.v1], [2.7, 5.7], [-14.2, 5.7]]), "well");
  scene.face(ground([[AGENT.u1, -0.7], [CARD.u0 - 0.5, -0.7], [CARD.u0 - 0.5, 0.7], [AGENT.u1, 0.7]]), "well");

  /* Norba's building and the airline's stand, at the back. */
  scene.pass = 1;
  lbox(scene, NORBA.u0, NORBA.v0, 0, NORBA.u1, NORBA.v1, NORBA.z);
  scene.lines(range(NORBA.v0 + 0.7, NORBA.v1 - 0.7, 4).map((v) => [P(NORBA.u1, v, 0.6), P(NORBA.u1, v, NORBA.z - 0.6)]), "hair");
  finStand(scene, FIN.u, FIN.v);

  /* The departure board on its legs, its face dark. */
  scene.pass = 2;
  for (const u of [BOARD.u0 + 2, BOARD.u1 - 2.4]) lbox(scene, u, BOARD.v - 0.4, 0, u + 0.4, BOARD.v, BOARD.z0);
  lbox(scene, BOARD.u0, BOARD.v - 0.4, BOARD.z0, BOARD.u1, BOARD.v, BOARD.z1);
  scene.fills([panel(BOARD.u0 + 0.25, BOARD.u1 - 0.25, BOARD.v + 0.01, BOARD.z0 + 0.25, BOARD.z1 - 0.25)], "ink");

  /* The phone on a stand in front of it, its screen showing the board. */
  scene.pass = 3;
  lbox(scene, PHONE.u0, PHONE.v - 0.6, 0, PHONE.u1, PHONE.v + 0.6, 0.3);
  lbox(scene, -15.8, PHONE.v - 0.15, 0.3, -15.4, PHONE.v + 0.15, PHONE.z0);
  lbox(scene, PHONE.u0, PHONE.v - 0.15, PHONE.z0, PHONE.u1, PHONE.v + 0.15, PHONE.z1);
  scene.fills([panel(PHONE.u0 + 0.25, PHONE.u1 - 0.25, PHONE.v + 0.16, PHONE.z0 + 0.6, PHONE.z1 - 0.5)], "ink");

  /* The agent's building. */
  scene.pass = 4;
  lbox(scene, AGENT.u0, AGENT.v0, 0, AGENT.u1, AGENT.v1, AGENT.z);
  scene.lines(range(AGENT.u0 + 0.7, AGENT.u1 - 0.7, 7).map((u) => [P(u, AGENT.v1, 0.6), P(u, AGENT.v1, AGENT.z - 1.6)]), "hair");
  scene.lines(range(AGENT.v0 + 0.7, AGENT.v1 - 0.7, 5).map((v) => [P(AGENT.u1, v, 0.6), P(AGENT.u1, v, AGENT.z - 0.6)]), "hair");

  /* The rebooking card on its stand, with its red Switch. */
  scene.pass = 5;
  lbox(scene, CARD.u0 - 0.5, CARD.v - 1.2, 0, CARD.u1 + 0.5, CARD.v + 1, CARD.z0);
  lbox(scene, CARD.u0, CARD.v - 0.3, CARD.z0, CARD.u1, CARD.v, CARD.z1);
  scene.lines([7.6, 6].map((z) => [P(CARD.u0 + 0.5, CARD.v + 0.01, z - 0.5), P(CARD.u1 - 0.5, CARD.v + 0.01, z - 0.5)]), "hair");
  scene.fills([panel(CARD.u0 + 0.5, CARD.u0 + 5, CARD.v + 0.02, 2.4, 3.8)], "mark");

  const L = layout(scene, W, H, { l: 40, r: 340, t: 100, b: 60 });
  return { L };
})();

const ROWS = [
  { n: "1", title: "The airline moves a flight", sub: "Norba's webhook reaches the agent" },
  { n: "2", title: "…or you snap the board", sub: "Muse Spark reads it, finds your trip" },
  { n: "3", title: "Better flights, explained", sub: "Searched again, in the same chat" },
  { n: "4", title: "One tap switches", sub: "The airline changes the booking" },
];

export function GuardianDrawing() {
  const { at, plane, K, paths } = DRAWING.L;
  const pts = (list: V3[]) => list.map((p) => at(p).map((n) => n.toFixed(1)).join(",")).join(" ");
  const step = (i: number) => 1500 + i * 260;
  const red = { fill: "none", stroke: "var(--hr-rust)", strokeWidth: 1.4, strokeDasharray: "5 3", className: "fx-wire" };
  const onBoard = (u: number, z: number) => plane(P(u, BOARD.v + 0.03, z), ALONG, UP_DOWN);
  const onCard = (u: number, z: number) => plane(P(u, CARD.v + 0.03, z), ALONG, UP_DOWN);
  const cols = [0.7, 4.2, 9.3, 12.2];
  const rowZ = (i: number) => 8.2 - i * 1.7;
  const g = (u: number, v: number) => P(u, v, 0.05);

  return (
    <Sheet code="R-04" title="A guardian after booking" W={W} H={H}>
      <Paths list={paths} />

      {/* The board's rows, the cancelled one in red; the card's flights and its Switch. */}
      <g className="fx-fade font-mono" style={{ animationDelay: "800ms" }}>
        <text transform={onBoard(BOARD.u0 + 0.7, 10)} fontSize={0.6 * K} letterSpacing="0.14em" fill="var(--hr-panel)">
          DEPARTURES
        </text>
        {ROWS_ON_BOARD.map((r, i) =>
          r.map((cell, j) => (
            <text key={`${i}${j}`} transform={onBoard(BOARD.u0 + cols[j], rowZ(i))} fontSize={0.52 * K} fill={r[3] === "CANCELLED" ? "var(--hr-rust)" : "var(--hr-panel)"}>
              {cell}
            </text>
          )),
        )}
        <text transform={onCard(CARD.u0 + 0.5, 9.3)} fontSize={0.55 * K} letterSpacing="0.1em" fill="var(--hr-rust)">
          BETTER FLIGHTS
        </text>
        {[
          ["AA 41", "12:05", "JFK", 7.6],
          ["IB 6251", "13:30", "JFK", 6],
        ].map(([f, t, d, z]) => (
          <g key={f as string} fill="var(--hr-ink-strong)">
            <text transform={onCard(CARD.u0 + 0.5, z as number)} fontSize={0.5 * K}>
              {f}
            </text>
            <text transform={onCard(CARD.u0 + 4, z as number)} fontSize={0.5 * K}>
              {t}
            </text>
            <text transform={onCard(CARD.u0 + 6.8, z as number)} fontSize={0.5 * K}>
              {`→ ${d}`}
            </text>
          </g>
        ))}
        <text transform={onCard(CARD.u0 + 1.1, 2.75)} fontSize={0.6 * K} letterSpacing="0.1em" fill="var(--hr-panel)">
          SWITCH
        </text>
      </g>

      {/* What Muse Spark read: the row on the board, and the same row on the phone's screen. */}
      <g className="fx-fade" style={{ animationDelay: `${step(1)}ms` }}>
        <polyline
          points={pts([P(BOARD.u0 + 0.4, BOARD.v + 0.04, rowZ(1) - 0.45), P(BOARD.u1 - 0.4, BOARD.v + 0.04, rowZ(1) - 0.45), P(BOARD.u1 - 0.4, BOARD.v + 0.04, rowZ(1) + 0.75), P(BOARD.u0 + 0.4, BOARD.v + 0.04, rowZ(1) + 0.75), P(BOARD.u0 + 0.4, BOARD.v + 0.04, rowZ(1) - 0.45)])}
          fill="none"
          stroke="var(--hr-rust)"
          strokeWidth={1.4}
        />
        {range(PHONE.z0 + 1.4, PHONE.z1 - 1.2, 3).map((z, i) => (
          <polyline key={i} points={pts([P(PHONE.u0 + 0.5, PHONE.v + 0.18, z), P(PHONE.u1 - 0.5, PHONE.v + 0.18, z)])} fill="none" stroke={i === 2 ? "var(--hr-rust)" : "var(--hr-panel)"} strokeWidth={1.2} />
        ))}
      </g>

      {/* The webhook in ink from the airline through Norba; the photo and the answer in red. */}
      <g className="fx-fade" style={{ animationDelay: "1100ms" }}>
        <polyline points={pts([g(FIN.u, FIN.v), g(NORBA.u1, FIN.v)])} fill="none" stroke="var(--hr-ink-strong)" strokeWidth={1} strokeDasharray="5 3" className="fx-wire" />
        <polyline points={pts([g(1.5, NORBA.v1), g(1.5, AGENT.v0)])} fill="none" stroke="var(--hr-ink-strong)" strokeWidth={1} strokeDasharray="5 3" className="fx-wire" />
        <polyline points={pts([g(-14.2, 5), g(2, 5), g(2, AGENT.v1)])} {...red} />
        <polyline points={pts([g(AGENT.u1, 0), g(CARD.u0 - 0.5, 0)])} {...red} />
      </g>

      <Tag at={at(P((BOARD.u0 + BOARD.u1) / 2, BOARD.v, BOARD.z1))} off={[-30, -40]} title="Departure board" sub="At the airport" />
      <Tag at={at(P(PHONE.u0, PHONE.v + 0.6, 0.3))} off={[30, 44]} title="Your photo" sub="Dropped into the chat" />
      <Tag at={at(P(FIN.u + 2.2, FIN.v, 6.6))} off={[20, -44]} title="Airline" sub="Moves the flight" />
      <Tag at={at(P(NORBA.u0, NORBA.v1, NORBA.z))} off={[-70, -44]} title="Norba API" sub="order.schedule_changed" />
      <Tag at={at(P(AGENT.u0, AGENT.v1, AGENT.z / 2))} off={[-4, -112]} title="Agent" sub="Finds your booking" made />
      <Tag at={at(P(CARD.u1, CARD.v, CARD.z0))} off={[24, 40]} title="Better flights" sub="One tap to switch" made />

      <Badge at={at(g(1.5, -8))} n="1" delay={step(0)} />
      <Badge at={at(P(PHONE.u1, PHONE.v, PHONE.z1))} n="2" delay={step(1)} />
      <Badge at={at(P(CARD.u0, CARD.v, CARD.z1))} n="3" delay={step(2)} />
      <Badge at={at(P(CARD.u0 + 5, CARD.v, 3.8))} n="4" delay={step(3)} />

      <Legend x={W - 304} y={64} w={280} heading="When a flight changes" rows={ROWS} delay={step} row={40} />
    </Sheet>
  );
}
