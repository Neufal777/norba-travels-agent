"use client";

import * as React from "react";

/**
 * Axonometric line drawings on gridded paper — the toolkit of the Norba landing
 * page, in this app's tokens: a scene is modelled in metres, projected isometrically at
 * module load, and drawn as fine line with paper-filled faces, so the markup is
 * static and renders on the server.
 *
 * Hidden lines are removed the painter's way. Faces added directly are drawn
 * in the order they are added; boxes and posts handed to `Scene.queue` are
 * sorted back to front first, which is what a room full of furniture needs.
 *
 * The lines ink in the first time a sheet scrolls into view; under
 * prefers-reduced-motion the drawing is still from the start.
 */

/* ── Projection ───────────────────────────────────────────────────────────── */

/** A point or a direction in metres: x east, y south, z up. */
export type V3 = number[];
export type P2 = [number, number];

export const COS30 = Math.sqrt(3) / 2;

/** Isometric projection: x runs down-right, y down-left, z up. The viewer looks from +x +y +z. */
export const iso = ([x, y, z]: V3): P2 => [(x - y) * COS30, (x + y) * 0.5 - z];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = (pts: V3[]): V3 => [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);

/** Whether a surface with this outward normal faces the viewer. */
const facing = (n: V3) => n[0] + n[1] + n[2] > 1e-9;

export const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/** A rectangle lying flat at height `z`. */
export const patch = (x0: number, y0: number, x1: number, y1: number, z = 0): V3[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
];

/* ── Scene ────────────────────────────────────────────────────────────────── */

/**
 * face     — a visible surface: paper fill, outline
 * line     — an edge or a main line
 * fine     — secondary detail
 * hair     — texture: seams, slats, tiles
 * dash     — set-out lines
 * ink      — a solid dark fill
 * shadow   — a hatched shadow
 * accent   — a line in the brand red
 * mark     — a solid brand-red fill
 * markface — a surface in the brand red, outlined
 * well     — a recess in shade: muted fill, no outline
 * belt     — a fine dotted line that runs, for a moving conveyor
 * ghost    — a surface of something absent: paper fill, faint dashed outline
 */
export type Kind =
  | "face"
  | "line"
  | "fine"
  | "hair"
  | "dash"
  | "ink"
  | "shadow"
  | "accent"
  | "mark"
  | "markface"
  | "well"
  | "belt"
  | "ghost";

export interface Run {
  pts: V3[];
  close: boolean;
}

export interface Prim {
  runs: Run[];
  kind: Kind;
  /** Which pass inks it in. */
  pass: number;
}

interface Queued {
  min: V3;
  max: V3;
  draw: () => void;
}

/** Ground shadows fall from a low western sun: down-right on the sheet. */
const SUN = { x: 0.62, y: -0.18 };

export class Scene {
  prims: Prim[] = [];
  pass = 0;
  /** Whether what is drawn now counts towards the extent the sheet is framed on. */
  framing = true;
  frame = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  /** When set, every kind drawn passes through it: how a piece is drawn as absent. */
  tint: ((k: Kind) => Kind) | null = null;
  private queued: Queued[] = [];

  include(p: V3) {
    const [a, b] = iso(p);
    this.frame.minX = Math.min(this.frame.minX, a);
    this.frame.maxX = Math.max(this.frame.maxX, a);
    this.frame.minY = Math.min(this.frame.minY, b);
    this.frame.maxY = Math.max(this.frame.maxY, b);
  }

  run(pts: V3[], close = false): Run[] {
    if (this.framing) pts.forEach((p) => this.include(p));
    return [{ pts, close }];
  }

  add(kind: Kind, runs: Run[]) {
    this.prims.push({ runs, kind: this.tint ? this.tint(kind) : kind, pass: this.pass });
  }

  face(pts: V3[], kind: Kind = "face") {
    this.add(kind, this.run(pts, true));
  }

  line(pts: V3[], kind: Kind = "line") {
    this.add(kind, this.run(pts));
  }

  lines(segs: V3[][], kind: Kind) {
    if (segs.length) this.add(kind, segs.flatMap((s) => this.run(s)));
  }

  fills(polys: V3[][], kind: Kind = "ink") {
    if (polys.length) this.add(kind, polys.flatMap((q) => this.run(q, true)));
  }

  /** A convex solid: draws the faces that face the viewer, whatever their winding. */
  solid(v: V3[], faces: number[][], kind: Kind = "face") {
    const c = centroid(v);
    for (const f of faces) {
      const pts = f.map((i) => v[i]);
      let n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
      if (dot(n, sub(centroid(pts), c)) < 0) n = n.map((x) => -x);
      if (facing(n)) this.face(pts, kind);
    }
  }

  /** A box on horizontal axes `a` and `b` and up, from corner `o`. */
  orientedBox(o: V3, a: V3, b: V3, h: number, kind: Kind = "face") {
    const at = (u: number, w: number, z: number): V3 => [o[0] + a[0] * u + b[0] * w, o[1] + a[1] * u + b[1] * w, o[2] + z];
    this.solid(
      [at(0, 0, 0), at(1, 0, 0), at(1, 1, 0), at(0, 1, 0), at(0, 0, h), at(1, 0, h), at(1, 1, h), at(0, 1, h)],
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
      ],
      kind,
    );
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind: Kind = "face") {
    this.orientedBox([x0, y0, z0], [x1 - x0, 0, 0], [0, y1 - y0, 0], z1 - z0, kind);
  }

  /**
   * A convex loop extruded between two outlines with the same number of
   * points (a prism, or a frustum when the top is smaller): its visible side
   * as one outlined surface, so a curved wall has no seams, then its top.
   */
  loft(bottom: V3[], top: V3[], kind: Kind = "face") {
    const n = bottom.length;
    const c = centroid([...bottom, ...top]);
    const seen = bottom.map((_, i) => {
      const j = (i + 1) % n;
      const q = [bottom[i], bottom[j], top[j], top[i]];
      let nn = cross(sub(q[1], q[0]), sub(q[3], q[0]));
      if (dot(nn, sub(centroid(q), c)) < 0) nn = nn.map((x) => -x);
      return facing(nn);
    });
    // The visible sides of a convex loop are one unbroken run.
    const start = seen.findIndex((s, i) => s && !seen[(i - 1 + n) % n]);
    if (start >= 0) {
      const idx: number[] = [];
      for (let k = 0; k <= n; k++) {
        const i = (start + k) % n;
        idx.push(i);
        if (!seen[i]) break;
      }
      this.face([...idx.map((i) => bottom[i]), ...[...idx].reverse().map((i) => top[i])], kind);
    } else if (seen[0]) {
      this.face(top, kind);
    }
    if (top[0][2] >= bottom[0][2]) this.face(top, kind);
  }

  /** A vertical cylinder (or frustum, with a top radius). */
  vcyl(cx: number, cy: number, r0: number, z0: number, z1: number, r1 = r0, kind: Kind = "face") {
    const T = range(0, 2 * Math.PI, 36).slice(0, -1);
    this.loft(
      T.map((t) => [cx + r0 * Math.cos(t), cy + r0 * Math.sin(t), z0]),
      T.map((t) => [cx + r1 * Math.cos(t), cy + r1 * Math.sin(t), z1]),
      kind,
    );
  }

  /** Fills the convex hull of the shadows `pts` cast on the ground. */
  shadow(pts: V3[]) {
    const p = pts.map(([x, y, z]) => [x + z * SUN.x, y + z * SUN.y, 0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const turn = (o: V3, a: V3, b: V3) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const chain = (list: V3[]) => {
      const h: V3[] = [];
      for (const q of list) {
        while (h.length >= 2 && turn(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
        h.push(q);
      }
      return h.slice(0, -1);
    };
    this.add("shadow", this.run([...chain(p), ...chain([...p].reverse())], true));
  }

  /** Holds a piece that fits its bounding box until `flush`, which draws the pieces back to front. */
  queue(min: V3, max: V3, draw: () => void) {
    this.queued.push({ min, max, draw });
  }

  /**
   * Draws the queued pieces so that each comes after everything it stands
   * behind: A goes before B when A lies wholly west of, north of or below B.
   */
  flush() {
    const q = this.queued;
    this.queued = [];
    const eps = 1e-6;
    const behind = (a: Queued, b: Queued) =>
      a.max[0] <= b.min[0] + eps || a.max[1] <= b.min[1] + eps || a.max[2] <= b.min[2] + eps;
    const depth = (a: Queued) => [0, 1, 2].reduce((s, i) => s + a.min[i] + a.max[i], 0);
    const after: number[][] = q.map(() => []);
    const waiting = q.map(() => 0);
    for (let i = 0; i < q.length; i++) {
      for (let j = i + 1; j < q.length; j++) {
        const ij = behind(q[i], q[j]);
        const ji = behind(q[j], q[i]);
        if (ij && !ji) {
          after[i].push(j);
          waiting[j]++;
        } else if (ji && !ij) {
          after[j].push(i);
          waiting[i]++;
        }
      }
    }
    const done = q.map(() => false);
    for (let k = 0; k < q.length; k++) {
      let pick = -1;
      for (let i = 0; i < q.length; i++) {
        if (done[i] || waiting[i] > 0) continue;
        if (pick < 0 || depth(q[i]) < depth(q[pick])) pick = i;
      }
      // A cycle cannot be drawn exactly; the shallowest piece left goes next.
      if (pick < 0) {
        for (let i = 0; i < q.length; i++) if (!done[i] && (pick < 0 || depth(q[i]) < depth(q[pick]))) pick = i;
      }
      done[pick] = true;
      for (const j of after[pick]) waiting[j]--;
      q[pick].draw();
    }
  }
}

/* ── An airliner ──────────────────────────────────────────────────────────── */

/** The full-size model: fuselage radius and length, in metres. */
const R = 2.9;
const LEN = 64;

/** Fuselage radius and centre height at station `s` metres aft of the nose. */
function station(s: number) {
  if (s < 6) {
    const u = 1 - s / 6;
    return { r: R * Math.sqrt(Math.max(0, 1 - u * u)), cz: 4.6 - 0.7 * u * u };
  }
  if (s <= 42) return { r: R, cz: 4.6 };
  const u = (s - 42) / (LEN - 42);
  return { r: R * (1 - 0.8 * Math.pow(u, 1.3)), cz: 4.6 + 2.1 * Math.pow(u, 1.6) };
}

/** The visible side of the fuselage, round its section. */
const FRONT0 = -Math.PI / 4;
const FRONT1 = (3 * Math.PI) / 4;

/**
 * The hero's airliner, for the other sheets: facing north (−y), nose at
 * (`px`, `ny`), on the ground at `z0`, at `sc` of a widebody's size. Model
 * coordinates are a lateral offset (+ to its left, which faces the viewer), a
 * station aft of the nose and a height. Draw `far`, `gear`, `body` and `near`
 * in that order; anything standing between those layers goes between them.
 */
export function airliner(scene: Scene, px: number, ny: number, z0: number, sc: number) {
  const P = (x: number, s: number, z: number): V3 => [px + x * sc, ny + s * sc, z0 + z * sc];
  const hull = (s: number, t: number): V3 => {
    const { r, cz } = station(s);
    return P(r * Math.cos(t), s, cz + r * Math.sin(t));
  };
  const top = (s: number) => {
    const { r, cz } = station(s);
    return cz + r;
  };
  const wing = (m: number): V3[] => [P(m * 2.6, 19, 3), P(m * 30, 35.5, 5.2), P(m * 30, 38.8, 5.2), P(m * 2.6, 32, 3)];
  const onWing = (m: number, u: number, v: number): V3 => {
    const [le0, le1, te1, te0] = wing(m);
    const le = le0.map((c, i) => c + (le1[i] - c) * u);
    const te = te0.map((c, i) => c + (te1[i] - c) * u);
    return le.map((c, i) => c + (te[i] - c) * v);
  };
  const stab = (m: number): V3[] => [P(m * 0.8, 54, 6.1), P(m * 10, 59.5, 6.7), P(m * 10, 62, 6.7), P(m * 0.8, 61.5, 6.3)];

  function engine(m: number) {
    const cx = m * 11.5;
    const prof = (s: number) => 1.6 - 0.5 * Math.pow(s / 7, 2);
    const ring = (s: number, t: number): V3 => P(cx + prof(s) * Math.cos(t), 20.5 + s, 2.05 + prof(s) * Math.sin(t));
    const S = range(0, 7, 14);
    const rim = range(0, 2 * Math.PI, 28).map((t) => ring(0, t));
    scene.face([...S.map((s) => ring(s, FRONT1)), ...[...S].reverse().map((s) => ring(s, FRONT0))]);
    scene.line(range(FRONT0, FRONT1, 14).map((t) => ring(0, t)), "fine");
    scene.line(rim.filter((_, i) => i <= 7 || i >= 21), "line");
    scene.line(range(FRONT0, FRONT1, 14).map((t) => ring(3.2, t)), "hair");
    scene.face(range(0, 2 * Math.PI, 24).map((t) => ring(7, t)));
    scene.fills([range(0, 2 * Math.PI, 18).map((t) => P(cx + 0.45 * Math.cos(t), 27.5, 2.05 + 0.45 * Math.sin(t)))]);
    scene.face([ring(1.2, Math.PI / 2), P(cx, 22.5, 3.65), P(cx, 28, 3.75), ring(6, Math.PI / 2)]);
  }

  return {
    hull,
    P,

    gear() {
      for (const m of [-1, 1]) {
        const gx = m * 4.6;
        scene.line([P(gx, 28.5, 3), P(gx, 28.5, 0.9)]);
        scene.fills([27.6, 29.4].map((s) => range(0, 2 * Math.PI, 16).map((t) => P(gx, s + 0.9 * Math.cos(t), 0.9 + 0.9 * Math.sin(t)))));
      }
      scene.line([P(0, 4.5, 2.4), P(0, 4.5, 0.7)]);
      scene.fills([range(0, 2 * Math.PI, 14).map((t) => P(0, 4.5 + 0.7 * Math.cos(t), 0.7 + 0.7 * Math.sin(t)))]);
    },

    far() {
      scene.face(wing(-1));
      scene.face(stab(-1));
      engine(-1);
    },

    body() {
      const S = range(0, LEN, 96);
      scene.face([...S.map((s) => hull(s, FRONT1)), ...[...S].reverse().map((s) => hull(s, FRONT0))]);
      scene.face(range(0, 2 * Math.PI, 16).map((t) => hull(LEN, t)));
      scene.lines(range(9, 57, 12).map((s) => range(FRONT0, FRONT1, 18).map((t) => hull(s, t))), "hair");
      scene.lines([Math.PI / 2, -0.12].map((t) => range(6, 58, 26).map((s) => hull(s, t))), "hair");
      scene.line(range(4.5, 56, 52).map((s) => hull(s, -0.3)), "accent");
      const doors = [6.5, 23, 40, 52];
      const wins = range(9, 56, 47).filter((s) => doors.every((dd) => Math.abs(s - dd) > 1.6));
      scene.fills(wins.map((s) => [hull(s, 0.42), hull(s + 0.42, 0.42), hull(s + 0.42, 0.6), hull(s, 0.6)]));
      scene.lines(
        doors.map((s) => [hull(s - 0.55, -0.2), hull(s + 0.55, -0.2), hull(s + 0.55, 0.78), hull(s - 0.55, 0.78), hull(s - 0.55, -0.2)]),
        "fine",
      );
      scene.line([hull(44, -0.55), hull(46.6, -0.55), hull(46.6, -1.05), hull(44, -1.05), hull(44, -0.55)], "fine");
      scene.line([hull(13, -0.55), hull(15.4, -0.55), hull(15.4, -1.05), hull(13, -1.05), hull(13, -0.55)], "fine");
      scene.fills([
        [hull(3.1, 0.62), hull(4.4, 0.6), hull(4.5, 0.86), hull(3.4, 0.92)],
        [hull(3.5, 1.02), hull(4.55, 0.96), hull(4.6, 1.22), hull(3.7, 1.3)],
      ]);
    },

    near() {
      scene.face(stab(1));
      scene.face([P(0, 47, top(47)), P(0, 58.5, 19.5), P(0, 62.5, 19.5), P(0, LEN - 0.4, top(LEN - 0.4))]);
      scene.line([P(0, 60.4, 19.4), P(0, 62.3, top(62.3) + 0.2)], "fine");
      scene.fills([[P(0, 57.2, 14.4), P(0, 59.6, 14.4), P(0, 59.6, 16.8), P(0, 57.2, 16.8)]], "mark");
      engine(1);
      scene.face(wing(1));
      scene.line(range(0, 0.8, 8).map((u) => onWing(1, u, 0.72)), "fine");
      scene.line(range(0.8, 1, 3).map((u) => onWing(1, u, 0.62)), "fine");
      scene.lines(range(0.08, 0.72, 4).map((u) => [onWing(1, u, 0.72), onWing(1, u, 1)]), "fine");
      scene.lines(range(0.25, 0.65, 4).map((u) => [onWing(1, u, 0.48), onWing(1, u + 0.07, 0.48)]), "hair");
      scene.face([onWing(1, 1, 0), P(30.6, 38.2, 8.6), P(30.6, 39.6, 8.6), onWing(1, 1, 1)]);
    },

    /** All of it, in order. */
    all() {
      this.far();
      this.gear();
      this.body();
      this.near();
    },

    shadow() {
      scene.shadow([
        ...range(0, LEN, 16).flatMap((s) => [hull(s, 0), hull(s, Math.PI), hull(s, Math.PI / 2)]),
        ...wing(1),
        ...wing(-1),
        ...stab(1),
        ...stab(-1),
      ]);
    },
  };
}

/* ── Sheet layout ─────────────────────────────────────────────────────────── */

export interface Layout {
  K: number;
  at: (p: V3) => P2;
  paths: { kind: Kind; pass: number; d: string }[];
  /**
   * An SVG transform that lays text on the plane through `o` spanned by the
   * unit directions `u` (along the text) and `v` (down the text). One unit of
   * the text is one sheet pixel, so a font size in metres is `metres * K`:
   * text set in fractions of a unit renders badly at a large scale.
   */
  plane: (o: V3, u: V3, v: V3) => string;
  /** A viewBox of `w`×`h` centred on a point, for a phone's crop of the sheet. */
  crop: (p: V3, w: number, h: number) => string;
}

/** Fits a scene's framed extent into a `W`×`H` sheet, keeping `pad` clear on each side. */
export function layout(scene: Scene, W: number, H: number, pad: { l: number; r: number; t: number; b: number }): Layout {
  const f = scene.frame;
  const K = Math.min((W - pad.l - pad.r) / (f.maxX - f.minX), (H - pad.t - pad.b) / (f.maxY - f.minY));
  const OX = pad.l + (W - pad.l - pad.r - K * (f.maxX - f.minX)) / 2 - K * f.minX;
  const OY = pad.t + (H - pad.t - pad.b - K * (f.maxY - f.minY)) / 2 - K * f.minY;
  const at = (p: V3): P2 => {
    const [x, y] = iso(p);
    return [OX + K * x, OY + K * y];
  };
  const toPath = (runs: Run[]) =>
    runs
      .map(
        (r) =>
          r.pts
            .map((p, i) => {
              const [x, y] = at(p);
              return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join("") + (r.close ? "Z" : ""),
      )
      .join("");
  return {
    K,
    at,
    paths: scene.prims.map((p) => ({ kind: p.kind, pass: p.pass, d: toPath(p.runs) })),
    plane: (o, u, v) => {
      const [a, b] = iso(u);
      const [c, d] = iso(v);
      const [e, g] = at(o);
      return `matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${e.toFixed(1)} ${g.toFixed(1)})`;
    },
    crop: (p, w, h) => {
      const [x, y] = at(p);
      return `${(x - w / 2).toFixed(0)} ${(y - h / 2).toFixed(0)} ${w} ${h}`;
    },
  };
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

export const STROKE: Record<Kind, React.SVGProps<SVGPathElement>> = {
  face: { fill: "var(--hr-panel)", stroke: "var(--hr-ink-strong)", strokeWidth: 1, strokeLinejoin: "round" },
  line: { fill: "none", stroke: "var(--hr-ink-strong)", strokeWidth: 1, strokeLinecap: "round", strokeLinejoin: "round" },
  fine: { fill: "none", stroke: "var(--hr-ink-strong)", strokeWidth: 0.6, strokeLinecap: "round" },
  hair: { fill: "none", stroke: "var(--hr-ink-strong)", strokeOpacity: 0.45, strokeWidth: 0.5, strokeLinecap: "round" },
  dash: { fill: "none", stroke: "var(--hr-ink-strong)", strokeOpacity: 0.55, strokeWidth: 0.6, strokeDasharray: "6 3 1.5 3" },
  ink: { fill: "var(--hr-ink-strong)", stroke: "none" },
  shadow: { fill: "var(--fx-hatch)", stroke: "none" },
  accent: { fill: "none", stroke: "var(--hr-rust)", strokeWidth: 1.2, strokeLinecap: "round" },
  mark: { fill: "var(--hr-rust)", stroke: "none" },
  markface: { fill: "var(--hr-rust)", stroke: "var(--hr-ink-strong)", strokeWidth: 1, strokeLinejoin: "round" },
  well: { fill: "var(--hr-surface-2)", stroke: "none" },
  belt: { fill: "none", stroke: "var(--hr-ink-strong)", strokeOpacity: 0.55, strokeWidth: 0.7, strokeDasharray: "1.5 5.5", strokeLinecap: "round" },
  ghost: { fill: "var(--hr-panel)", stroke: "var(--hr-ink-strong)", strokeOpacity: 0.4, strokeWidth: 0.8, strokeDasharray: "3 2.5", strokeLinejoin: "round" },
};

/** Draws a piece as absent: surfaces become ghosts, lines and fills fade to hairlines. */
export const GHOST = (k: Kind): Kind => (k === "face" || k === "markface" ? "ghost" : k === "shadow" ? "shadow" : "hair");

/** Line kinds that ink in along their length; the rest fade in. */
const INKED = new Set<Kind>(["face", "line", "fine", "markface"]);

export function Paths({ list, step = 140 }: { list: Layout["paths"]; step?: number }) {
  return (
    <>
      {list.map((p, i) => (
        <path
          key={i}
          d={p.d}
          {...STROKE[p.kind]}
          className={INKED.has(p.kind) ? "fx-ink" : p.kind === "belt" ? "fx-fade fx-belt" : "fx-fade"}
          pathLength={INKED.has(p.kind) ? 1 : undefined}
          style={{ animationDelay: `${p.pass * step}ms` }}
        />
      ))}
    </>
  );
}

/** Mono glyph advance at the callout sizes, for sizing the paper behind a label. */
const ADV = { title: 6.95, sub: 5.75 };

/**
 * A note on a leader line: a dot on the drawing, an elbow, and the title over
 * a rule with a line under it — plain, or a chip when it names a call
 * (`code` in red, then the rest). Paper sits behind the text so no line of the
 * drawing runs through it.
 */
export function Callout({
  at: [ax, ay],
  off,
  side,
  title,
  sub,
  chip,
  red,
  delay = 1400,
}: {
  at: P2;
  off: P2;
  side: "left" | "right";
  title: string;
  sub?: string;
  chip?: { code: string; text: string };
  /** A red anchor and a running red wire mark the part the note is about. */
  red?: boolean;
  delay?: number;
}) {
  const subText = chip ? `${chip.code} ${chip.text}` : (sub ?? "");
  const titleW = title.length * ADV.title;
  const subW = subText.length * ADV.sub + (chip ? 12 : 0);
  const width = Math.max(titleW, subW) + 4;
  const [lx, ly] = [ax + off[0], ay + off[1]];
  const end = lx + (side === "left" ? -width : width);
  const x0 = side === "left" ? end : lx;
  return (
    <g className="fx-fade font-mono max-md:hidden" style={{ animationDelay: `${delay}ms` }}>
      {red ? (
        <polyline points={`${ax},${ay} ${lx},${ly}`} fill="none" stroke="var(--hr-rust)" strokeWidth={1} strokeDasharray="4 3" className="fx-wire" />
      ) : (
        <polyline points={`${ax},${ay} ${lx},${ly}`} fill="none" stroke="var(--hr-ink-strong)" strokeWidth={0.6} />
      )}
      <circle cx={ax} cy={ay} r={red ? 3 : 2} fill={red ? "var(--hr-rust)" : "var(--hr-ink-strong)"} />
      {red ? <circle cx={ax} cy={ay} r={7} fill="none" stroke="var(--hr-rust)" strokeWidth={0.8} className="fx-ping" /> : null}
      <rect x={x0 - 3} y={ly - 17} width={titleW + 6} height={15} fill="var(--hr-panel)" />
      <line x1={lx} y1={ly} x2={end} y2={ly} stroke="var(--hr-ink-strong)" strokeWidth={0.6} />
      <text x={x0} y={ly - 5} fontSize={10.5} letterSpacing="0.06em" fill="var(--hr-ink-strong)" className="uppercase">
        {title}
      </text>
      {chip ? (
        <g transform={`translate(${x0} ${ly + 5})`}>
          <rect width={subW} height={17} fill="var(--hr-panel)" stroke="var(--hr-line-strong)" strokeWidth={1} />
          <text x={6} y={12} fontSize={9.5} fill="var(--hr-ink-strong)">
            <tspan fill="var(--hr-rust)" fontWeight={600}>
              {chip.code}
            </tspan>{" "}
            {chip.text}
          </text>
        </g>
      ) : sub ? (
        <g transform={`translate(${x0} ${ly + 3})`}>
          <rect x={-3} width={subW + 6} height={15} fill="var(--hr-panel)" />
          <text y={11} fontSize={9.5} fill="var(--hr-ink-3)">
            {sub}
          </text>
        </g>
      ) : null}
    </g>
  );
}

/**
 * A drawing sheet: the sheet number and title in the corner, an optional
 * sample-data badge, and the drawing itself, scaled to fit the band (or, on a
 * phone, cropped to `phone`). The drawing inks in the first time the sheet
 * scrolls into view.
 */
export function Sheet({
  code,
  title,
  badge,
  W,
  H,
  phone,
  children,
}: {
  code: string;
  title: string;
  badge?: string;
  W: number;
  H: number;
  phone?: string;
  children: React.ReactNode;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [live, setLive] = React.useState(false);
  const [narrow, setNarrow] = React.useState(false);
  const hatch = `fx-hatch-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const el = root.current;
    if (!el) return () => mq.removeEventListener("change", sync);
    // The sheet inks in the first time a fifth of it is on screen and stays
    // inked; its looping parts run only while any of it is on screen.
    const io = new IntersectionObserver(
      ([e]) => {
        setLive(e.isIntersecting);
        if (e.isIntersecting && e.intersectionRatio >= 0.2) setPlaying(true);
      },
      { threshold: [0, 0.2] },
    );
    io.observe(el);
    return () => {
      mq.removeEventListener("change", sync);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={root} className="relative h-full w-full">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hr-ink-3)] sm:left-6 sm:top-5">
        <span className="border border-[var(--hr-ink-strong)] bg-[var(--hr-panel)] px-1.5 py-0.5 text-[var(--hr-ink-strong)]">{code}</span>
        <span className="hidden bg-[var(--hr-panel)] px-1 sm:inline">{title}</span>
      </div>
      {badge ? (
        <span className="absolute right-4 top-4 z-10 border border-dashed border-[var(--hr-line-strong)] bg-[var(--hr-panel)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--hr-ink-4)] sm:right-6 sm:top-5">
          {badge}
        </span>
      ) : null}
      <svg
        viewBox={narrow && phone ? phone : `0 0 ${W} ${H}`}
        preserveAspectRatio={narrow && phone ? "xMidYMid slice" : "xMidYMid meet"}
        className={`fx-drawing absolute inset-0 h-full w-full${playing ? " fx-play" : ""}${live ? " fx-live" : ""}`}
        style={{ "--fx-hatch": `url(#${hatch})` } as React.CSSProperties}
        role="img"
        aria-label={title}
      >
        <defs>
          <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--hr-ink-strong)" strokeOpacity="0.3" strokeWidth="0.8" />
          </pattern>
        </defs>
        {children}
      </svg>
    </div>
  );
}
