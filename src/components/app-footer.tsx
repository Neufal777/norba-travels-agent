"use client";

import { ArrowUpRight } from "lucide-react";
import { NorbaLogo } from "./brand";
import { Sq } from "./status";
import { useStatus } from "./use-status";

type FooterLink = { label: string; href: string };

/** What the footer links to, inline: Norba first, then what the agent is built with and for. */
const LINKS: FooterLink[] = [
  { label: "Airlines", href: "https://norba.io/docs/airlines" },
  { label: "API docs", href: "https://norba.io/docs" },
  { label: "Changelog", href: "https://norba.io/docs/changelog" },
  { label: "Norba Travel", href: "https://booking.norba.io" },
  { label: "Meta Model API", href: "https://dev.meta.ai/docs/models" },
  { label: "Muse Spark", href: "https://dev.meta.ai/resources/blog/build-with-muse-spark/" },
];

const ENV_LABEL = { sandbox: "Sandbox", production: "Production", mock: "Mock data" } as const;

/** The site's footer: one fixed strip under the chat, so the page never grows past the screen. */
export function AppFooter() {
  const status = useStatus();
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
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="cursor-pointer text-[11.5px] text-hr-ink-3 no-underline transition-colors hover:text-hr-ink-strong">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-x-4">
          {status && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-4">
              <Sq className={status.norba.environment === "mock" ? "bg-hr-concrete" : "bg-hr-success"} />
              Norba · {ENV_LABEL[status.norba.environment]}
            </span>
          )}
          <span className="hidden text-[11px] text-hr-ink-4 sm:inline">© {new Date().getFullYear()} Norba</span>
        </div>
      </div>
    </footer>
  );
}
