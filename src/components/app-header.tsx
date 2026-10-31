"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowUpRight, Moon, Plus, Sun } from "lucide-react";
import { HackathonHosts, NorbaWordmark } from "./brand";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sq } from "./status";
import { useStatus } from "./use-status";

const ENV_LABEL = { sandbox: "Sandbox", production: "Production", mock: "Mock data" } as const;

/** The hackathon this was built for, its hosts' marks first — the first thing on the page. */
function HackathonStrip() {
  return (
    <div className="border-b border-hr-line bg-hr-surface-2">
      <div className="mx-auto flex h-9 w-full max-w-[1120px] items-center gap-3 px-5 md:px-10">
        <HackathonHosts size={20} />
        <p className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">
          <span className="text-hr-ink-strong">Meta Global AI Developer Hackathon</span>
          <span className="max-sm:hidden"> · Hosted by Meta &amp; Cerebral Valley · Oct 26 – Nov 4, 2026</span>
        </p>
        <a
          href="https://norba.io"
          target="_blank"
          rel="noreferrer"
          className="group ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 transition-colors hover:text-hr-ink-strong"
        >
          <span className="max-sm:hidden">Powered by</span> <span className="hr-underline text-hr-ink-strong">Norba</span>
          <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px" />
        </a>
      </div>
    </div>
  );
}

export function AppHeader({ onNewChat }: { onNewChat?: () => void }) {
  const status = useStatus();
  const { resolvedTheme, setTheme } = useTheme();
  const meta = status?.brain.mode === "meta";
  return (
    <header className="hr-frost relative z-40 shrink-0 border-b border-hr-line">
      <HackathonStrip />
      <div className="mx-auto flex h-12 w-full max-w-[1120px] items-center gap-x-6 px-5 md:px-10">
        <Link href="/" onClick={onNewChat} className="cursor-pointer no-underline">
          <NorbaWordmark sub="Travels Agent" />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {status && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 md:inline-flex">
                    <Sq className={meta ? "bg-hr-success" : "bg-hr-concrete"} />
                    {meta ? status.brain.model : "Offline planner"}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  {meta ? "Meta Model API answers: it reads your request and drives the searches." : "No MODEL_API_KEY yet: a rule-based planner drives the same tools. Set the key to switch to Muse Spark."}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 md:inline-flex">
                    <Sq className={status.norba.environment === "production" ? "bg-hr-success" : status.norba.environment === "sandbox" ? "bg-hr-rust" : "bg-hr-concrete"} />
                    Norba · {ENV_LABEL[status.norba.environment]}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  {status.norba.mode === "mock" ? "No NORBA_API_KEY: flights are generated locally." : `Searches reach the airlines' ${status.norba.environment} systems through ${status.norba.baseUrl}.`}
                </TooltipContent>
              </Tooltip>
            </>
          )}

          <Link href="/agency" className="hidden cursor-pointer font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 no-underline transition-colors hover:text-hr-ink-strong sm:inline">
            Agency desk
          </Link>
          <Link href="/docs" className="hidden cursor-pointer font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3 no-underline transition-colors hover:text-hr-ink-strong sm:inline">
            Docs
          </Link>

          {onNewChat && (
            <Button variant="outline" size="sm" onClick={onNewChat} className="cursor-pointer">
              <Plus /> New trip
            </Button>
          )}

          <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" className="cursor-pointer" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Sun className="size-3.5 dark:hidden" />
            <Moon className="hidden size-3.5 dark:block" />
          </Button>
        </div>
      </div>
    </header>
  );
}
