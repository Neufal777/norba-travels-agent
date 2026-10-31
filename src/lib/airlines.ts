/** Display names for the carriers the agent is most likely to meet; anything else shows its IATA code. */
const NAMES: Record<string, string> = {
  A3: "Aegean Airlines",
  OA: "Olympic Air",
  AA: "American Airlines",
  MQ: "Envoy Air",
  OH: "PSA Airlines",
  PT: "Piedmont Airlines",
  AF: "Air France",
  KL: "KLM",
  IB: "Iberia",
  BA: "British Airways",
  LH: "Lufthansa",
  UX: "Air Europa",
  VY: "Vueling",
  QR: "Qatar Airways",
  AS: "Alaska Airlines",
  JL: "Japan Airlines",
};

export const airlineName = (code: string) => NAMES[code] ?? code;
