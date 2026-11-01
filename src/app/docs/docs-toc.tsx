"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** How far below the top of the window a section's heading counts as the one being read (the sticky header is 48px). */
const READ_LINE = 120;

/**
 * The docs page's table of contents. It follows the reading: the section under the read line is marked, a vermilion
 * bar slides along the rail to it and the rail fills up to it. A click scrolls smoothly to the section and holds the
 * mark there while the page travels, so the bar does not run through every section on the way.
 */
export function DocsToc({ sections }: { sections: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState(sections[0][0]);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const items = useRef(new Map<string, HTMLLIElement>());
  const travelling = useRef<number | null>(null);

  const read = useCallback(() => {
    if (travelling.current !== null) return;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    let current = sections[0][0];
    for (const [id] of sections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= READ_LINE) current = id;
    }
    setActive(atBottom ? sections[sections.length - 1][0] : current);
  }, [sections]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    };
    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (sections.some(([id]) => id === fromHash)) setActive(fromHash);
    else read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [read, sections]);

  useLayoutEffect(() => {
    const li = items.current.get(active);
    if (li) setBar({ top: li.offsetTop, height: li.offsetHeight });
  }, [active]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (travelling.current !== null) window.clearTimeout(travelling.current);
    travelling.current = window.setTimeout(() => {
      travelling.current = null;
      read();
    }, smooth ? 900 : 50);
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  };

  const index = sections.findIndex(([id]) => id === active);

  return (
    <nav aria-label="On this page" className="hidden lg:block">
      <div className="sticky top-20">
        <p className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-4">
          <span>On this page</span>
          <span className="tabular-nums">
            <span className="text-hr-ink-strong">{String(index + 1).padStart(2, "0")}</span> / {String(sections.length).padStart(2, "0")}
          </span>
        </p>
        <ol className="relative">
          {/* The rail, its filled part up to the section being read, and the bar on that section. */}
          <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-hr-line-strong" />
          {bar && (
            <>
              <span
                aria-hidden
                className="absolute left-0 top-0 w-px origin-top bg-hr-ink-3 transition-[height] duration-500 ease-hr motion-reduce:transition-none"
                style={{ height: bar.top }}
              />
              <span
                aria-hidden
                className="absolute left-[-1px] top-0 w-[3px] bg-hr-rust transition-[transform,height] duration-500 ease-hr motion-reduce:transition-none"
                style={{ transform: `translateY(${bar.top}px)`, height: bar.height }}
              />
            </>
          )}
          {sections.map(([id, title], i) => {
            const on = id === active;
            const passed = i < index;
            return (
              <li
                key={id}
                ref={(el) => {
                  if (el) items.current.set(id, el);
                  else items.current.delete(id);
                }}
              >
                <a
                  href={`#${id}`}
                  onClick={(e) => go(e, id)}
                  aria-current={on ? "location" : undefined}
                  className={cn(
                    "group flex cursor-pointer items-baseline gap-2 py-1.5 pl-4 pr-2 text-[12.5px] leading-[1.45] no-underline outline-none transition-[color,background-color] duration-300 ease-hr focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hr-rust",
                    on
                      ? "bg-[color-mix(in_srgb,var(--hr-rust)_8%,transparent)] text-hr-ink-strong"
                      : cn("hover:bg-hr-highlight hover:text-hr-ink-strong", passed ? "text-hr-ink-2" : "text-hr-ink-3"),
                  )}
                >
                  <span
                    className={cn(
                      "w-5 shrink-0 font-mono text-[10px] tabular-nums transition-colors duration-300",
                      on ? "text-hr-rust" : "text-hr-ink-4 group-hover:text-hr-ink-2",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={cn("transition-transform duration-300 ease-hr motion-reduce:transition-none", on ? "translate-x-0.5" : "group-hover:translate-x-1")}>{title}</span>
                </a>
              </li>
            );
          })}
        </ol>
        <a
          href="#provenance"
          onClick={(e) => {
            e.preventDefault();
            history.replaceState(null, "", location.pathname);
            setActive(sections[0][0]);
            window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }}
          className={cn(
            "mt-4 inline-flex cursor-pointer items-center gap-1.5 pl-4 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 no-underline transition-[opacity,color] duration-300 hover:text-hr-ink-strong",
            index > 0 ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          tabIndex={index > 0 ? 0 : -1}
        >
          ↑ Back to top
        </a>
      </div>
    </nav>
  );
}
