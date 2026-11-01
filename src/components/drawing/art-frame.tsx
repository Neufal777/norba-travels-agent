import { HackathonHosts, NorbaLogo } from "@/components/brand";

/**
 * The frame every illustration wears outside the app (the README, the video): the Norba mark and the project's name,
 * the hackathon it was built for with its hosts' marks, the drawing on its paper, and a footer saying it was built
 * during the event.
 */
export function ArtFrame({ id, ratio, children }: { id: string; ratio: string; children: React.ReactNode }) {
  return (
    <section id={id} className="w-[960px] border border-hr-line-strong bg-hr-panel">
      <header className="flex items-center gap-3 border-b border-hr-line-strong px-4 py-3">
        <NorbaLogo className="size-7" />
        <span className="font-mono text-[15px] tracking-[-0.02em] text-hr-ink-strong">
          Norba <span className="text-hr-ink-3">Travels Agent</span>
        </span>
        <span className="ml-auto flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-hr-ink-2">
          Meta Global AI Developer Hackathon · 2026
          <HackathonHosts size={22} />
        </span>
      </header>
      <div className="na-paper relative" style={{ aspectRatio: ratio }}>
        {children}
      </div>
      <footer className="flex items-center gap-2 border-t border-hr-line-strong px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-hr-ink-3">
        <span className="size-1.5 bg-hr-rust" />
        Built during the hackathon · Oct 26 – Nov 4, 2026
        <span className="ml-auto">Startups track · Build for Your World</span>
      </footer>
    </section>
  );
}
