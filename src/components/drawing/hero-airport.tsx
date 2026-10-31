"use client";

import { airliner, Callout, layout, patch, Paths, range, Scene, Sheet, type V3 } from "./iso";

/**
 * The welcome drawing: a trip from the request to the seat, as one airport scene. The departure terminal with its
 * glazed front, a jet bridge on the aircraft at its stand, baggage on its way, the tower, a runway with an aircraft
 * just airborne over it, and the route on to the destination's own runway and tower — the callouts naming the
 * agent's steps. Codes go on signs, paint and plinths; the aircraft carry no lettering.
 */

const scene = new Scene();
/** Aircraft at seven tenths of a widebody: about 45 m long. */
const SC = 0.7;

const T = { x0: -44, y0: -60, x1: 32, y1: -38, z: 10 };
const STAND = { x: 6, ny: -31 };
const TW = { x: 98, y: -6 };
const RW = { x0: 62, x1: 80, y0: -70, y1: 28 };
const FLY = { x: 71, ny: -86, z: 22 };
const DEST = { x: 112, y: -154 };
const PLINTH = { x0: DEST.x - 3.4, y0: DEST.y + 12, x1: DEST.x + 3.4, y1: DEST.y + 16.5, z: 3 };

/* ── Ground ─────────────────────────────────────────────────────────────── */
scene.pass = 0;

// The apron set out, unframed so the sheet frames on what stands on it.
scene.framing = false;
scene.line([[-50, -38, 0], [56, -38, 0], [56, 30, 0], [-50, 30, 0], [-50, -38, 0]], "dash");
scene.framing = true;

// Runway, north–south: centre line, piano keys, touchdown bars, edge lights, and the far end's keys.
scene.face(patch(RW.x0, RW.y0, RW.x1, RW.y1));
scene.lines(
  range(RW.y0 + 10, RW.y1 - 20, 10).map((y) => [[71, y, 0], [71, y + 4.5, 0]]),
  "fine",
);
scene.fills(range(RW.x0 + 1.4, RW.x1 - 2.4, 8).map((x) => patch(x, RW.y1 - 6.5, x + 1, RW.y1 - 1.2)));
scene.fills(range(RW.x0 + 1.4, RW.x1 - 2.4, 8).map((x) => patch(x, RW.y0 + 1.2, x + 1, RW.y0 + 5.5)));
scene.fills([RW.y1 - 30, RW.y1 - 42].flatMap((y) => [patch(65, y, 67.4, y + 5), patch(74.6, y, 77, y + 5)]));
scene.fills(range(RW.y0 + 4, RW.y1 - 4, 14).flatMap((y) => [patch(RW.x0 - 1, y, RW.x0 - 0.3, y + 0.7), patch(RW.x1 + 0.3, y, RW.x1 + 1, y + 0.7)]));

// Taxiway to the runway: centre line and the red holding bar.
scene.face(patch(38, 9, RW.x0, 17));
scene.line([[38, 13, 0], [RW.x0 - 1, 13, 0]], "dash");
scene.lines(range(9.5, 16.5, 5).map((y) => [[RW.x0 - 4.5, y, 0], [RW.x0 - 3.5, y, 0]]), "accent");

// The stand: the lead-in line to the nose, its stop bar and the safety line round it.
scene.line([[STAND.x, STAND.ny - 1, 0], [STAND.x, 30, 0]], "dash");
scene.line([[STAND.x - 3, STAND.ny - 1.5, 0], [STAND.x + 3, STAND.ny - 1.5, 0]], "line");
scene.framing = false;
scene.line([[STAND.x - 26, -36, 0], [STAND.x + 26, -36, 0], [STAND.x + 26, 4, 0]], "hair");
scene.framing = true;

/* ── The destination, to the north-east ────────────────────────────────── */
scene.pass = 1;
scene.face(patch(DEST.x + 8, DEST.y - 34, DEST.x + 16, DEST.y + 24));
scene.lines(range(DEST.y - 28, DEST.y + 16, 7).map((y) => [[DEST.x + 12, y, 0], [DEST.x + 12, y + 3, 0]]), "hair");
scene.fills(range(DEST.x + 8.6, DEST.x + 14.6, 4).map((x) => patch(x, DEST.y + 20, x + 0.6, DEST.y + 23)));
scene.box(DEST.x - 16, DEST.y - 4, 0, DEST.x - 2, DEST.y + 5, 4.2);
scene.lines(range(DEST.x - 15, DEST.x - 3, 8).map((x) => [[x, DEST.y + 5, 0.4], [x, DEST.y + 5, 3.6]]), "hair");
scene.vcyl(DEST.x - 6, DEST.y - 14, 0.8, 0, 11, 0.6);
scene.vcyl(DEST.x - 6, DEST.y - 14, 1.5, 11, 13, 1.8);
scene.vcyl(DEST.x - 6, DEST.y - 14, 1.55, 11.5, 12.6, 1.75, "ink");
scene.vcyl(DEST.x - 6, DEST.y - 14, 2.1, 13, 13.5);
// The plinth that names it.
scene.box(PLINTH.x0, PLINTH.y0, 0, PLINTH.x1, PLINTH.y1, PLINTH.z);
scene.face(patch(PLINTH.x0, PLINTH.y0, PLINTH.x1, PLINTH.y1, PLINTH.z), "markface");

/* ── Departure airport ─────────────────────────────────────────────────── */
scene.pass = 2;

// The tower, east of the runway, clear of the climb-out.
scene.shadow([[TW.x - 3.6, TW.y - 3.6, 34], [TW.x + 3.6, TW.y + 3.6, 34], [TW.x - 3.6, TW.y + 3.6, 0], [TW.x + 3.6, TW.y - 3.6, 0]]);
scene.box(TW.x - 4, TW.y - 4, 0, TW.x + 4, TW.y + 4, 3.6);
scene.lines(range(TW.x - 3.4, TW.x + 3.4, 6).map((x) => [[x, TW.y + 4, 0.4], [x, TW.y + 4, 3.2]]), "hair");
scene.vcyl(TW.x, TW.y, 1.8, 3.6, 28, 1.4);
scene.lines(range(6, 26, 5).map((z) => range(-Math.PI / 4, (3 * Math.PI) / 4, 10).map((t) => [TW.x + 1.62 * Math.cos(t), TW.y + 1.62 * Math.sin(t), z])), "hair");
scene.vcyl(TW.x, TW.y, 2.4, 28, 29, 3.4);
scene.vcyl(TW.x, TW.y, 3.4, 29, 32.6, 3.9);
scene.vcyl(TW.x, TW.y, 3.45, 29.7, 32.1, 3.85, "ink");
scene.vcyl(TW.x, TW.y, 4.2, 32.6, 33.5, 3.4);
scene.line([[TW.x, TW.y, 33.5], [TW.x, TW.y, 39]], "fine");
scene.lines([[[TW.x - 1.4, TW.y, 37], [TW.x + 1.4, TW.y, 37]]], "fine");
scene.fills([range(0, 2 * Math.PI, 10).map((t) => [TW.x + 0.4 * Math.cos(t), TW.y + 0.4 * Math.sin(t), 39.2])], "mark");

// Terminal: the hall with its glazed south and east fronts, the roof and its clerestory, and the plant on it.
scene.shadow([[T.x0, T.y1, T.z], [T.x1, T.y1, T.z], [T.x1, T.y0, T.z], [T.x1, T.y1, 0], [T.x0, T.y1, 0]]);
scene.box(T.x0, T.y0, 0, T.x1, T.y1, T.z);
scene.lines(range(T.x0 + 1, T.x1 - 1, 37).map((x) => [[x, T.y1, 0.4], [x, T.y1, T.z - 1]]), "hair");
scene.lines(range(T.y0 + 1, T.y1 - 1, 11).map((y) => [[T.x1, y, 0.4], [T.x1, y, T.z - 1]]), "hair");
scene.lines([4.4, T.z - 1].map((z) => [[T.x0, T.y1, z], [T.x1, T.y1, z], [T.x1, T.y0, z]]), "fine");
scene.box(T.x0 - 1.2, T.y0 - 1.2, T.z, T.x1 + 1.6, T.y1 + 1.6, T.z + 0.8);
scene.box(-24, -55, T.z + 0.8, 18, -44, T.z + 3);
scene.lines(range(-23, 17, 20).map((x) => [[x, -44, T.z + 1]], ).map(([p]) => [p, [p[0], -44, T.z + 2.8]]), "hair");
scene.box(-38, -57, T.z + 0.8, -30, -51, T.z + 2.4);
scene.lines(range(-37.4, -30.6, 5).map((x) => [[x, -51, T.z + 1], [x, -51, T.z + 2.2]]), "hair");
scene.box(24, -57, T.z + 0.8, 29, -52, T.z + 1.8);
// The name board on the front, the entrance canopy and its columns.
scene.box(-38, T.y1, 5.6, -16, T.y1 + 0.25, 8.4, "ink");
scene.box(-12, T.y1, 4.4, 0, T.y1 + 3.6, 4.9);
scene.lines([-11.4, -6, -0.6].map((x) => [[x, T.y1 + 3.4, 0], [x, T.y1 + 3.4, 4.4]]), "fine");

// Lamp masts on the apron.
for (const [x, y] of [
  [-46, 24],
  [44, -30],
]) {
  scene.vcyl(x, y, 0.28, 0, 15);
  scene.box(x - 1.4, y - 0.45, 15, x + 1.4, y + 0.45, 15.7);
}

// Baggage on its way: a tug and three carts with cases, west of the stand, clear of the aircraft.
const TUG = { x: -42, y: -22 };
scene.box(TUG.x, TUG.y, 0.4, TUG.x + 3.6, TUG.y + 2.6, 1.8);
scene.box(TUG.x + 0.4, TUG.y + 0.4, 1.8, TUG.x + 2, TUG.y + 2.2, 3);
[0, 1].forEach((i) => {
  const x = TUG.x + 5 + i * 6.4;
  scene.line([[x - 1.4, TUG.y + 1.3, 0.9], [x, TUG.y + 1.3, 0.9]], "fine");
  scene.box(x, TUG.y, 0.5, x + 5.2, TUG.y + 2.6, 0.9);
  scene.box(x + 0.4, TUG.y + 0.4, 0.9, x + 2.4, TUG.y + 2.2, 2.3);
  scene.box(x + 2.8, TUG.y + 0.4, 0.9, x + 4.8, TUG.y + 2.2, i ? 2.7 : 1.9, i ? "markface" : "face");
});

/* ── The aircraft at its stand, and the jet bridge on its forward door ─── */
scene.pass = 3;
const parked = airliner(scene, STAND.x, STAND.ny, 0, SC);
parked.shadow();
parked.all();
const BX = STAND.x + 5;
scene.box(BX, T.y1, 3.4, BX + 2.8, -28.4, 5.8);
scene.lines(range(T.y1 + 1.5, -29.5, 6).map((y) => [[BX + 2.8, y, 3.6], [BX + 2.8, y, 5.6]]), "hair");
scene.vcyl(BX + 1.4, -27, 1.9, 3.2, 6);
scene.box(STAND.x + 2.4, -27.6, 3.3, BX + 0.4, -24.4, 5.7);
scene.vcyl(BX + 1.4, -26.2, 0.3, 0, 3.2);
scene.fills([BX + 0.6, BX + 2.2].map((x) => range(0, 2 * Math.PI, 10).map((t) => [x, -25.2 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t)])));

// Windsock by the runway.
scene.line([[85, 18, 0], [85, 18, 8]], "line");
scene.face([[85, 18, 8], [85, 14, 7.4], [85, 14.2, 6.7], [85, 18, 6.9]], "markface");
scene.lines([[[85, 16.4, 7.7], [85, 16.4, 6.8]]], "fine");

/* ── Airborne, just off the runway ─────────────────────────────────────── */
scene.pass = 4;
const flying = airliner(scene, FLY.x, FLY.ny, FLY.z, SC);
flying.shadow();
flying.far();
flying.body();
flying.near();

const W = 1200;
const H = 500;
const LAYOUT = layout(scene, W, H, { l: 110, r: 110, t: 50, b: 12 });
const PHONE = LAYOUT.crop([30, -34, 8], 620, 420);

/** The climb and the route on: along the runway, through the aircraft, to the destination's plinth. */
const route = (pts: V3[]) => pts.map((p) => LAYOUT.at(p).map((v) => v.toFixed(1)).join(",")).join(" ");
const CLIMB: V3[] = [
  [71, 8, 0],
  [71, -30, 0],
  [71, -54, FLY.z + 2.8],
];
const ONWARD: V3[] = [
  [71, -88, FLY.z + 4],
  [74, -112, 34],
  [84, -134, 40],
  [98, -152, 36],
  [DEST.x - 1, DEST.y + 4, 22],
  [DEST.x, DEST.y + 14, PLINTH.z + 0.4],
];

export function HeroAirport() {
  const { at, plane, K } = LAYOUT;
  const east: V3 = [1, 0, 0];
  const north: V3 = [0, -1, 0];
  const down: V3 = [0, 0, -1];
  return (
    <Sheet code="NT-01" title="From a sentence to a seat" W={W} H={H} phone={PHONE}>
      <Paths list={LAYOUT.paths} step={170} />

      {/* The route, in the brand red: the climb out, then on to the destination. */}
      <g className="fx-fade" style={{ animationDelay: "1250ms" }}>
        <polyline points={route(CLIMB)} fill="none" stroke="var(--hr-rust)" strokeWidth={1.4} strokeDasharray="5 3" strokeLinejoin="round" className="fx-wire" />
        <polyline points={route(ONWARD)} fill="none" stroke="var(--hr-rust)" strokeWidth={1.6} strokeDasharray="5 3" strokeLinejoin="round" className="fx-wire" />
        <circle cx={at([DEST.x, DEST.y + 14, PLINTH.z])[0]} cy={at([DEST.x, DEST.y + 14, PLINTH.z])[1]} r={8} fill="none" stroke="var(--hr-rust)" strokeWidth={0.8} className="fx-ping" />
      </g>

      {/* Paint and signs: the runway's numbers, the terminal's board, the stand, and the destination's code. */}
      <g className="fx-fade font-mono" style={{ animationDelay: "1050ms" }}>
        <text transform={plane([67.6, RW.y1 - 16, 0], east, [0, 1, 0])} fontSize={5 * K} fill="var(--hr-ink-strong)" letterSpacing="0.08em">
          36
        </text>
        <text transform={plane([75.4, RW.y0 + 14, 0], [-1, 0, 0], north)} fontSize={5 * K} fill="var(--hr-ink-strong)" letterSpacing="0.08em">
          18
        </text>
        <text transform={plane([-36.6, T.y1 + 0.26, 7.6], east, down)} fontSize={1.7 * K} fill="var(--hr-panel)" letterSpacing="0.12em">
          MAD
        </text>
        <text transform={plane([-29.4, T.y1 + 0.26, 7.6], east, down)} fontSize={0.95 * K} fill="var(--hr-panel)" letterSpacing="0.1em">
          DEPARTURES
        </text>
        <text transform={plane([-29.4, T.y1 + 0.26, 6.6], east, down)} fontSize={0.7 * K} fill="var(--hr-panel)" letterSpacing="0.1em">
          GATES 10–14
        </text>
        <text transform={plane([BX + 2.82, -31.6, 5.2], north, down)} fontSize={1.4 * K} fill="var(--hr-ink-strong)" letterSpacing="0.08em">
          12
        </text>
        <text transform={plane([STAND.x + 1.2, 22, 0], [0, -1, 0], [1, 0, 0])} fontSize={1.6 * K} fill="var(--hr-ink-strong)" letterSpacing="0.1em" opacity={0.7}>
          STAND 12
        </text>
        <text transform={plane([PLINTH.x0 + 0.5, PLINTH.y1, 2.3], east, down)} fontSize={1.8 * K} fill="var(--hr-ink-strong)" letterSpacing="0.12em">
          ATH
        </text>
      </g>

      <Callout at={at([-30, -52, T.z + 2.4])} off={[-50, -40]} side="left" title="01 Your request" sub="Places, dates, who is coming" delay={1450} />
      <Callout at={at([TW.x, TW.y, 31.5])} off={[70, 24]} side="right" title="03 Airline search" sub="Every airline, asked live" red delay={1550} />
      <Callout at={at([BX - 1, -26, 5.2])} off={[-140, 120]} side="left" title="06 Seats & bags" sub="The airline's own seat map" delay={1650} />
      <Callout at={at([FLY.x + 2, FLY.ny + 20, FLY.z + 3])} off={[60, 50]} side="right" title="11 Booking" sub="The order, made with the airline" delay={1750} />
      <Callout at={at([DEST.x + 2, DEST.y + 14, PLINTH.z])} off={[16, -96]} side="right" title="12 E-tickets" sub="Reference and tickets, by email" red delay={1850} />
    </Sheet>
  );
}
