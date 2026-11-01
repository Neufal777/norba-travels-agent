"use client";

import type { P2 } from "./iso";

/**
 * What the explanatory sheets share on top of the drawing itself: numbered discs on the drawing, name tags standing
 * over its pieces, and the legend that tells the numbers in order. Everything is set in sheet pixels, upright, so it
 * reads at a glance whatever the angle of the drawing under it.
 */

/** Sheet pixels to a tenth, so the server's and the browser's arithmetic print the same attributes. */
const r1 = ([x, y]: P2): P2 => [Math.round(x * 10) / 10, Math.round(y * 10) / 10];

/** Mono glyph advance at the tag and legend sizes, for sizing the paper behind the text. */
const ADV = { title: 6.95, sub: 5.45 };

/** A step's number in a disc: red on the main path, ink for the other ways in. */
export function Badge({ at, n, ink, delay }: { at: P2; n: string; ink?: boolean; delay: number }) {
  const [x, y] = r1(at);
  return (
    <g className="fx-fade font-mono" style={{ animationDelay: `${delay}ms` }}>
      <circle cx={x} cy={y} r={11.5} fill="var(--hr-panel)" />
      <circle cx={x} cy={y} r={9} fill={ink ? "var(--hr-ink-strong)" : "var(--hr-rust)"} />
      <text x={x} y={y + 0.5} fontSize={10.5} fontWeight={600} textAnchor="middle" dominantBaseline="central" fill="var(--hr-panel)">
        {n}
      </text>
    </g>
  );
}

/**
 * A piece's name on a framed tag, joined to the piece by a leader: the tag's centre stands `off` from the anchor. A
 * red square before the name marks what was built during the hackathon.
 */
export function Tag({ at, off: [dx, dy], title, sub, made, delay = 1000 }: { at: P2; off: P2; title: string; sub?: string; made?: boolean; delay?: number }) {
  const [x, y] = r1(at);
  const w = Math.max(title.length * ADV.title + (made ? 13 : 0), (sub?.length ?? 0) * ADV.sub) + 16;
  const h = sub ? 36 : 22;
  const [cx, cy] = [x + dx, y + dy];
  const [bx, by] = [cx - w / 2, cy - h / 2];
  // The leader meets the tag on the side that faces the anchor.
  const end: P2 = Math.abs(dy) * w >= Math.abs(dx) * h ? [cx, dy < 0 ? by + h : by] : [dx < 0 ? bx + w : bx, cy];
  return (
    <g className="fx-fade font-mono" style={{ animationDelay: `${delay}ms` }}>
      <polyline points={`${x},${y} ${end[0]},${end[1]}`} fill="none" stroke="var(--hr-ink-strong)" strokeWidth={0.8} />
      <circle cx={x} cy={y} r={2.4} fill="var(--hr-ink-strong)" />
      <rect x={bx} y={by} width={w} height={h} fill="var(--hr-panel)" stroke="var(--hr-ink-strong)" strokeWidth={1} />
      {made ? <rect x={bx + 8} y={by + 8} width={6} height={6} fill="var(--hr-rust)" /> : null}
      <text x={bx + 8 + (made ? 13 : 0)} y={by + 15} fontSize={10.5} letterSpacing="0.04em" fill="var(--hr-ink-strong)" className="uppercase">
        {title}
      </text>
      {sub ? (
        <text x={bx + 8} y={by + 28.5} fontSize={9} fill="var(--hr-ink-3)">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export type Row = { n: string; title: string; sub: string; ink?: boolean };

/**
 * The numbered steps in a panel, in order, appearing one after another as `delay(i)` says; rows after `split` sit
 * under a second heading. A key under them says what the red square on a tag means.
 */
export function Legend({
  x,
  y,
  w,
  heading,
  rows,
  split,
  splitHeading,
  delay,
  row = 34,
}: {
  x: number;
  y: number;
  w: number;
  heading: string;
  rows: readonly Row[];
  split?: number;
  splitHeading?: string;
  delay: (i: number) => number;
  row?: number;
}) {
  const gap = split !== undefined ? 40 : 0;
  const rowY = (i: number) => y + 48 + i * row + (split !== undefined && i >= split ? gap : 0);
  const bottom = rowY(rows.length - 1) + 22;
  return (
    <g className="font-mono">
      <rect x={x} y={y} width={w} height={bottom - y + 34} fill="var(--hr-panel)" stroke="var(--hr-line-strong)" />
      <text x={x + 16} y={y + 24} fontSize={10} letterSpacing="0.08em" fill="var(--hr-ink-3)">
        {heading.toUpperCase()}
      </text>
      {split !== undefined && splitHeading ? (
        <>
          <line x1={x} x2={x + w} y1={rowY(split) - 46} y2={rowY(split) - 46} stroke="var(--hr-line-strong)" />
          <text x={x + 16} y={rowY(split) - 24} fontSize={10} letterSpacing="0.08em" fill="var(--hr-ink-3)">
            {splitHeading.toUpperCase()}
          </text>
        </>
      ) : null}
      {rows.map((r, i) => (
        <g key={r.n} className="fx-fade" style={{ animationDelay: `${delay(i)}ms` }}>
          <circle cx={x + 25} cy={rowY(i) + 4} r={9} fill={r.ink ? "var(--hr-ink-strong)" : "var(--hr-rust)"} />
          <text x={x + 25} y={rowY(i) + 4.5} fontSize={10.5} fontWeight={600} textAnchor="middle" dominantBaseline="central" fill="var(--hr-panel)">
            {r.n}
          </text>
          <text x={x + 44} y={rowY(i)} fontSize={10.5} letterSpacing="0.04em" fill="var(--hr-ink-strong)" className="uppercase">
            {r.title}
          </text>
          <text x={x + 44} y={rowY(i) + 15} fontSize={9.5} fill="var(--hr-ink-3)">
            {r.sub}
          </text>
        </g>
      ))}
      <line x1={x} x2={x + w} y1={bottom + 6} y2={bottom + 6} stroke="var(--hr-line-strong)" />
      <rect x={x + 16} y={bottom + 16} width={6} height={6} fill="var(--hr-rust)" />
      <text x={x + 30} y={bottom + 22} fontSize={9} letterSpacing="0.06em" fill="var(--hr-ink-3)">
        BUILT DURING THE HACKATHON
      </text>
    </g>
  );
}
