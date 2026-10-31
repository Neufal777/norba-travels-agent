import { brain } from "@/server/agent/run";
import { config, norbaEnvironment, norbaMode } from "@/server/config";
import type { AppStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/** What the header shows: which brain answers and which Norba environment the searches reach. */
export function GET() {
  const status: AppStatus = { brain: brain(), norba: { mode: norbaMode(), environment: norbaEnvironment(), baseUrl: config.norba.baseUrl } };
  return Response.json(status);
}
