import "server-only";

/** Everything read from the environment, once. Keys never leave the server. */
export const config = {
  model: {
    apiKey: process.env.MODEL_API_KEY?.trim() ?? "",
    baseUrl: (process.env.MODEL_BASE_URL?.trim() || "https://api.meta.ai/v1").replace(/\/$/, ""),
    id: process.env.MODEL_ID?.trim() || "muse-spark-1.3",
    reasoningEffort: process.env.MODEL_REASONING_EFFORT?.trim() || "",
    /** How hard the group coordinator thinks: it weighs every traveller's options against each other. */
    plannerEffort: process.env.MODEL_PLANNER_EFFORT?.trim() || "high",
  },
  /** Muse Voice Transcribe, on the Meta Model API with the same key. */
  voice: { id: process.env.VOICE_MODEL_ID?.trim() || "muse-voice-transcribe-1.0" },
  /**
   * With a production Norba key, real bookings (cards charged, tickets issued) stay off unless this is "true": a
   * public demo should run on a sandbox key.
   */
  allowProductionBookings: process.env.ALLOW_PRODUCTION_BOOKINGS?.trim() === "true",
  /** Bearer token the MCP endpoint asks for; empty leaves it open (local development). */
  mcp: { token: process.env.MCP_TOKEN?.trim() ?? "" },
  /** Where this app is reached from outside, for the checkout links it hands out; empty uses the request's host. */
  publicUrl: (process.env.PUBLIC_URL?.trim() ?? "").replace(/\/$/, ""),
  norba: {
    apiKey: process.env.NORBA_API_KEY?.trim() ?? "",
    baseUrl: (process.env.NORBA_API_URL?.trim() || "https://api.norba.io").replace(/\/$/, ""),
  },
};

export const brainMode = (): "meta" | "offline" => (config.model.apiKey ? "meta" : "offline");

export const norbaMode = () => (config.norba.apiKey ? "live" : "mock");

export const norbaEnvironment = () =>
  !config.norba.apiKey ? "mock" : config.norba.apiKey.startsWith("nbr_live_") ? "production" : "sandbox";
