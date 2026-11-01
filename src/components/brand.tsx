/* eslint-disable @next/next/no-img-element -- two small avatars, served as they are */
import { cn } from "@/lib/utils";

/**
 * The Norba mark, drawn: a white arrow climbing to the north-east on a Vermilion tile, traced from norba.io's icon
 * on its 192-unit grid — the head is a 12-unit chevron cut square to the diagonal, the shaft 11.3 units wide.
 */
export function NorbaLogo({ className, title = "Norba" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 192 192" role="img" aria-label={title} className={cn("size-6 shrink-0", className)}>
      <rect width="192" height="192" rx="44" fill="#ef0302" />
      <path d="M66 54H138V126L126 138V74L62.5 137.5L54.5 129.5L118 66H54Z" fill="#fafafa" />
    </svg>
  );
}

/** The wordmark beside the mark, in Geist Mono as on norba.io. */
export function NorbaWordmark({ className, sub }: { className?: string; sub?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <NorbaLogo className="size-[22px]" />
      <span className="whitespace-nowrap font-mono text-[15px] leading-none tracking-[-0.03em] text-hr-ink-strong">
        Norba{sub && <span className="text-hr-ink-3 max-[420px]:hidden"> {sub}</span>}
      </span>
    </span>
  );
}

const HOSTS = [
  { name: "Meta", src: "/brands/meta.jpg", href: "https://cerebralvalley.ai/u/meta" },
  { name: "Cerebral Valley", src: "/brands/cerebral-valley.jpg", href: "https://cerebralvalley.ai/u/cv" },
];

/** The hackathon's hosts, as the event page shows them: two round avatars, the second tucked under the first. */
export function HackathonHosts({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <span className={cn("flex shrink-0 items-center -space-x-1.5", className)}>
      {HOSTS.map((h, i) => (
        <a
          key={h.name}
          href={h.href}
          target="_blank"
          rel="noreferrer"
          aria-label={h.name}
          title={h.name}
          className="relative inline-flex cursor-pointer rounded-full ring-2 ring-hr-surface transition-transform duration-300 ease-hr hover:z-10 hover:-translate-y-0.5"
          style={{ zIndex: HOSTS.length - i }}
        >
          <img src={h.src} alt={h.name} width={size} height={size} className="rounded-full bg-white object-cover" style={{ width: size, height: size }} />
        </a>
      ))}
    </span>
  );
}
