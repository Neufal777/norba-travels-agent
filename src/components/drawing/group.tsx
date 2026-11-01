"use client";

import { layout, Paths, range, Scene, Sheet, type V3 } from "./iso";
import { Badge, Legend, Tag } from "./kit";
import { ALONG, ground, lbox, P, UP_DOWN } from "./turned";

/**
 * Group trips from several cities. Three travellers' cities stand on the left, each with its own agent's kiosk on the
 * plinth; their routes rise in red and land together on New York's stand, a terminal and a tower. Behind them the
 * coordinator's tower reaches each route: it picks one flight per traveller so the group lands together.
 */

const W = 960;
const H = 500;

const CITIES = [
  { code: "LHR", who: "Tom · London", u: -19, v: -12 },
  { code: "CDG", who: "Léa · Paris", u: -16, v: -3 },
  { code: "MAD", who: "Ana · Madrid", u: -19, v: 6 },
];
const DEST = { u0: 11, u1: 19, v0: -4.5, v1: 2.5, z: 1.4 };
const LAND: V3 = P(15, -1, 5.4);
const COORD = { u0: 2, u1: 6, v0: -25, v1: -21, z: 8 };

/** A city's route: from the top of its kiosk up and over to New York. */
const route = (c: (typeof CITIES)[number]) => {
  const a = P(c.u + 2, c.v, 3.8);
  return range(0, 1, 28).map((t): V3 => [a[0] + (LAND[0] - a[0]) * t, a[1] + (LAND[1] - a[1]) * t, a[2] + (LAND[2] - a[2]) * t + 7 * Math.sin(Math.PI * t)]);
};

const DRAWING = (() => {
  const scene = new Scene();

  scene.pass = 0;
  scene.framing = false;
  scene.line([...ground([[-24, -27], [23, -27], [23, 11], [-24, 11]]), P(-24, -27, 0)], "dash");
  scene.shadow([...ground([[COORD.u0, COORD.v0], [COORD.u1, COORD.v0], [COORD.u1, COORD.v1], [COORD.u0, COORD.v1]]), P(COORD.u0, COORD.v1, COORD.z), P(COORD.u1, COORD.v1, COORD.z)]);
  for (const c of CITIES) scene.shadow([...ground([[c.u, c.v - 1.6], [c.u + 4, c.v + 1.6]]), P(c.u + 1, c.v, 3.8), P(c.u + 3, c.v, 3.8)]);
  scene.shadow([...ground([[DEST.u0, DEST.v0], [DEST.u1, DEST.v1]]), P(17.5, 1, 9), P(13, -4, 5)]);
  scene.framing = true;

  /* The coordinator's tower at the back. */
  scene.pass = 1;
  lbox(scene, COORD.u0, COORD.v0, 0, COORD.u1, COORD.v1, COORD.z);
  scene.lines(range(1, COORD.z - 2, 8).map((z) => [P(COORD.u0 + 0.5, COORD.v1, z), P(COORD.u1 - 0.5, COORD.v1, z)]), "hair");
  scene.lines(range(COORD.v0 + 0.7, COORD.v1 - 0.7, 4).map((v) => [P(COORD.u1, v, 0.7), P(COORD.u1, v, COORD.z - 0.7)]), "hair");

  /* Each city: a plinth, and the traveller's own agent as a kiosk on it with a lit screen. */
  CITIES.forEach((c, i) => {
    scene.pass = 2 + i;
    lbox(scene, c.u, c.v - 1.6, 0, c.u + 4, c.v + 1.6, 1.1);
    lbox(scene, c.u + 1, c.v - 0.8, 1.1, c.u + 3, c.v + 0.8, 3.8);
    scene.fills([[P(c.u + 1.3, c.v + 0.81, 2.4), P(c.u + 2.7, c.v + 0.81, 2.4), P(c.u + 2.7, c.v + 0.81, 3.4), P(c.u + 1.3, c.v + 0.81, 3.4)]], "mark");
  });

  /* New York: the stand, a terminal and a tower. */
  scene.pass = 5;
  lbox(scene, DEST.u0, DEST.v0, 0, DEST.u1, DEST.v1, DEST.z);
  lbox(scene, 12, -4, DEST.z, 17, -1.2, 5);
  scene.lines(range(12.5, 16.5, 8).map((u) => [P(u, -1.2, DEST.z + 0.5), P(u, -1.2, 4.2)]), "hair");
  {
    const c = P(17.6, 1, 0);
    scene.vcyl(c[0], c[1], 0.55, DEST.z, 7.6);
    scene.vcyl(c[0], c[1], 1.1, 7.6, 8.8, 1.3);
    scene.vcyl(c[0], c[1], 1.3, 8.8, 9.1);
  }

  const L = layout(scene, W, H, { l: 170, r: 330, t: 84, b: 40 });
  return { L };
})();

const ROWS = [
  { n: "1", title: "One agent per traveller", sub: "Each searches from their own city" },
  { n: "2", title: "The coordinator decides", sub: "Muse Spark, high reasoning effort" },
  { n: "3", title: "Code checks the plan", sub: "Everyone lands within the window" },
  { n: "4", title: "Each pays their own seat", sub: "A checkout link per traveller" },
];

export function GroupDrawing() {
  const { at, plane, K, paths } = DRAWING.L;
  const pts = (list: V3[]) => list.map((p) => at(p).map((n) => n.toFixed(1)).join(",")).join(" ");
  const step = (i: number) => 1500 + i * 260;
  const apex = (c: (typeof CITIES)[number]) => route(c)[14];
  const top = P((COORD.u0 + COORD.u1) / 2, (COORD.v0 + COORD.v1) / 2, COORD.z);

  return (
    <Sheet code="G-03" title="Group trips from several cities" W={W} H={H}>
      <Paths list={paths} />

      {/* The cities' codes on their plinths, New York's on its stand. */}
      <g className="fx-fade font-mono" style={{ animationDelay: "800ms" }} fill="var(--hr-ink-strong)">
        {CITIES.map((c) => (
          <text key={c.code} transform={plane(P(c.u + 0.5, c.v + 1.6, 0.9), ALONG, UP_DOWN)} fontSize={0.8 * K} letterSpacing="0.08em">
            {c.code}
          </text>
        ))}
        <text transform={plane(P(DEST.u0 + 0.6, DEST.v1, 1.15), ALONG, UP_DOWN)} fontSize={1 * K} letterSpacing="0.1em">
          JFK
        </text>
      </g>

      {/* The coordinator reaching each route, in ink. */}
      <g className="fx-fade" style={{ animationDelay: `${step(1)}ms` }}>
        {CITIES.map((c) => (
          <polyline key={c.code} points={pts([top, apex(c)])} fill="none" stroke="var(--hr-ink-strong)" strokeWidth={0.9} strokeDasharray="2 3" />
        ))}
      </g>

      {/* Each traveller's route in red, landing together. */}
      <g className="fx-fade" style={{ animationDelay: "1100ms" }}>
        {CITIES.map((c) => (
          <polyline key={c.code} points={pts(route(c))} fill="none" stroke="var(--hr-rust)" strokeWidth={1.4} strokeDasharray="5 3" className="fx-wire" />
        ))}
        <circle cx={at(LAND)[0]} cy={at(LAND)[1]} r={9} fill="none" stroke="var(--hr-rust)" strokeWidth={0.9} className="fx-ping" />
      </g>

      {CITIES.map((c) => (
        <Tag key={c.code} at={at(P(c.u, c.v, 1.1))} off={[c.code === "MAD" ? -104 : -134, 0]} title={c.who} sub="Their own agent" made />
      ))}
      <Tag at={at(P((COORD.u0 + COORD.u1) / 2, COORD.v1, COORD.z))} off={[-40, -62]} title="Coordinator" sub="Muse Spark · reasoning high" made />
      <Tag at={at(P(DEST.u1, DEST.v1, 0))} off={[20, 40]} title="New York" sub="Everyone lands together" />

      <Badge at={at(P(-13.5, -3, 3.8))} n="1" delay={step(0)} />
      <Badge at={at(top)} n="2" delay={step(1)} />
      <Badge at={at(LAND)} n="3" delay={step(2)} />
      <Badge at={at(P(-15, 6, 1.1))} n="4" delay={step(3)} />

      <Legend x={W - 304} y={64} w={280} heading="A group, landing together" rows={ROWS} delay={step} row={40} />
    </Sheet>
  );
}
