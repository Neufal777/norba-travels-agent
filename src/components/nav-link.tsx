"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGES: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Agent", icon: MessageSquare },
  { href: "/agency", label: "Agency desk", icon: Building2 },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

/** The app's three pages as framed links: the current one in the accent, the others filling on hover. Below `sm` they
 * keep their icon only. */
export function NavLinks({ onHome, className }: { onHome?: () => void; className?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Pages" className={cn("flex items-center gap-1.5", className)}>
      {PAGES.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? "page" : undefined}
            onClick={href === "/" ? onHome : undefined}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] no-underline outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hr-rust",
              active
                ? "border-hr-rust bg-[color-mix(in_srgb,var(--hr-rust)_10%,transparent)] text-hr-ink-strong"
                : "border-hr-line-strong text-hr-ink-1 hover:border-hr-ink-strong hover:bg-hr-signal hover:text-hr-ink-strong",
            )}
          >
            <Icon className={cn("size-3.5 shrink-0", active && "text-hr-rust")} />
            <span className="max-sm:sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
