import type { Metadata } from "next";
import { deskModel } from "@/server/agency";
import { AgencyDesk } from "./agency-desk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agency desk", description: "Client requests drafted by Muse Spark, checked against the travel policy, booked through Norba." };

export default function Agency() {
  return <AgencyDesk model={deskModel()} />;
}
