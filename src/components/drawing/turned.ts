import type { Kind, Scene, V3 } from "./iso";

/**
 * The frame the explanatory sheets are modelled in, turned 18° from the isometric axes so a scene reads left to
 * right: `u` runs along the sheet to the right, `v` towards the viewer, `z` up, in metres. A larger `u` or `v` stands
 * nearer the viewer, so pieces are drawn left to right and back to front.
 */
const TURN = (18 * Math.PI) / 180;
export const [C, S] = [Math.cos(TURN), Math.sin(TURN)];
export const P = (u: number, v: number, z: number): V3 => [u * C + v * S, v * C - u * S, z];

/** Directions for text: along a face that stands at a constant `v`, down it, and across the ground towards the viewer. */
export const ALONG: V3 = [C, -S, 0];
export const UP_DOWN: V3 = [0, 0, -1];
export const ACROSS: V3 = [S, C, 0];

/** A box on the turned axes, from (`u0`, `v0`, `z0`) to (`u1`, `v1`, `z1`). */
export function lbox(scene: Scene, u0: number, v0: number, z0: number, u1: number, v1: number, z1: number, kind?: Kind) {
  scene.orientedBox(P(u0, v0, z0), [(u1 - u0) * C, -(u1 - u0) * S, 0], [(v1 - v0) * S, (v1 - v0) * C, 0], z1 - z0, kind);
}

/** Points on the ground. */
export const ground = (pts: [number, number][]): V3[] => pts.map(([u, v]) => P(u, v, 0));

/** A rectangle standing at `v`, from `u0` to `u1` and `z0` to `z1`. */
export const panel = (u0: number, u1: number, v: number, z0: number, z1: number): V3[] => [P(u0, v, z0), P(u1, v, z0), P(u1, v, z1), P(u0, v, z1)];

/** A plain tail fin on a plinth at (`u`, `v`): an airline's stand, its code going on the plinth. */
export function finStand(scene: Scene, u: number, v: number) {
  lbox(scene, u, v - 1.6, 0, u + 4, v + 1.6, 1.1);
  const fin = (w: number) => [P(u + 0.4, w, 1.1), P(u + 3.6, w, 1.1), P(u + 2.9, w, 6.6), P(u + 1.5, w, 6.6)];
  const [b, f] = [fin(v - 0.25), fin(v + 0.25)];
  scene.face([b[1], b[2], f[2], f[1]]);
  scene.face([b[2], b[3], f[3], f[2]]);
  scene.face(f);
}
