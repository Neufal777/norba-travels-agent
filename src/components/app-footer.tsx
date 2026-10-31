"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { NorbaLogo } from "./brand";

type FooterLink = { label: string; href: string };

/** The agent's own pages: the traveller's chat, the agency desk, its docs and the MCP server for other assistants. */
const LINKS: FooterLink[] = [
  { label: "Agent", href: "/" },
  { label: "Agency desk", href: "/agency" },
  { label: "Docs", href: "/docs" },
  { label: "MCP server", href: "/docs#mcp" },
];


/** The site's footer: one fixed strip under the chat, so the page never grows past the screen. */
export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-hr-line bg-hr-surface-2">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2.5 md:px-10">
        <a
          href="https://norba.io"
          target="_blank"
          rel="noreferrer"
          className="group inline-flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-strong no-underline"
        >
          <NorbaLogo className="size-4" />
          Powered by Norba
          <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px" />
        </a>
        <nav aria-label="Links" className="hidden items-center gap-x-4 md:flex">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="cursor-pointer text-[11.5px] text-hr-ink-3 no-underline transition-colors hover:text-hr-ink-strong">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-x-4">
          <span className="hidden text-[11px] text-hr-ink-4 sm:inline">© {new Date().getFullYear()} Norba</span>
        </div>
      </div>
    </footer>
  );
}
