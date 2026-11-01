import type { Metadata } from "next";
import { ArtFrame } from "@/components/drawing/art-frame";
import { ArchitectureDrawing } from "@/components/drawing/architecture";
import { GroupDrawing } from "@/components/drawing/group";
import { GuardianDrawing } from "@/components/drawing/guardian";
import { HeroAirport } from "@/components/drawing/hero-airport";
import { VisionDrawing } from "@/components/drawing/vision";

export const metadata: Metadata = { title: "Illustrations", robots: { index: false } };

/** The project's illustrations in their branded frames, one under another: the README's images are taken from here. */
export default function Art() {
  return (
    <main className="flex flex-col items-center gap-10 bg-hr-surface p-10">
      <ArtFrame id="trip" ratio="1200 / 500">
        <HeroAirport />
      </ArtFrame>
      <ArtFrame id="architecture" ratio="960 / 540">
        <ArchitectureDrawing />
      </ArtFrame>
      <ArtFrame id="vision" ratio="960 / 480">
        <VisionDrawing />
      </ArtFrame>
      <ArtFrame id="group" ratio="960 / 500">
        <GroupDrawing />
      </ArtFrame>
      <ArtFrame id="guardian" ratio="960 / 500">
        <GuardianDrawing />
      </ArtFrame>
    </main>
  );
}
