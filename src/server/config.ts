import "server-only";

/** Everything read from the environment, once. Keys never leave the server. */
export const config = {
  model: {
    apiKey: process.env.MODEL_API_KEY?.trim() ?? "",
    baseUrl: (process.env.MODEL_BASE_URL?.trim() || "https://api.meta.ai/v1").replace(/\/$/, ""),
    id: process.env.MODEL_ID?.trim() || "muse-spark-1.3",
    reasoningEffort: process.env.MODEL_REASONING_EFFORT?.trim() || "",
  },
  norba: {
    apiKey: process.env.NORBA_API_KEY?.trim() ?? "",
    baseUrl: (process.env.NORBA_API_URL?.trim() || "https://api.norba.io").replace(/\/$/, ""),
    bookingUrl: process.env.NORBA_BOOKING_URL?.trim() || "https://booking.norba.io",
  },
};

export const brainMode = () => (config.model.apiKey ? "meta" : "offline");

export const norbaMode = () => (config.norba.apiKey ? "live" : "mock");

export const norbaEnvironment = () =>
  !config.norba.apiKey ? "mock" : config.norba.apiKey.startsWith("nbr_live_") ? "production" : "sandbox";
