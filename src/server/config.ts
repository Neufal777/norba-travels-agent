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
  /** Muse Spark Open, Meta's open-weight model, served by a partner (Baseten by default); the agency desk runs on it. */
  openModel: {
    apiKey: process.env.OPEN_MODEL_API_KEY?.trim() ?? "",
    baseUrl: (process.env.OPEN_MODEL_BASE_URL?.trim() || "https://inference.baseten.co/v1").replace(/\/$/, ""),
    id: process.env.OPEN_MODEL_ID?.trim() || "meta-models/muse-spark-open-1026",
  },
  /** Muse Voice Transcribe, on the Meta Model API with the same key. */
  voice: { id: process.env.VOICE_MODEL_ID?.trim() || "muse-voice-transcribe-1.0" },
  /** Bearer token the MCP endpoint asks for; empty leaves it open (local development). */
  mcp: { token: process.env.MCP_TOKEN?.trim() ?? "" },
  /** Where this app is reached from outside, for the checkout links it hands out; empty uses the request's host. */
  publicUrl: (process.env.PUBLIC_URL?.trim() ?? "").replace(/\/$/, ""),
  norba: {
    apiKey: process.env.NORBA_API_KEY?.trim() ?? "",
    baseUrl: (process.env.NORBA_API_URL?.trim() || "https://api.norba.io").replace(/\/$/, ""),
  },
};

export const brainMode = () => (config.model.apiKey ? "meta" : "offline");

/** Where the open-weight model runs: its partner when configured, otherwise Muse Spark stands in. */
export const openModelMode = (): "open" | "meta" | "offline" => (config.openModel.apiKey ? "open" : config.model.apiKey ? "meta" : "offline");

export const norbaMode = () => (config.norba.apiKey ? "live" : "mock");

export const norbaEnvironment = () =>
  !config.norba.apiKey ? "mock" : config.norba.apiKey.startsWith("nbr_live_") ? "production" : "sandbox";
