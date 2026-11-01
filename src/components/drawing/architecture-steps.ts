/** The steps, in the order a booking goes through them, then the two other ways in. */
export const STEPS = [
  { n: "1", title: "You ask", sub: "Type, say it or drop a file" },
  { n: "2", title: "Muse Spark plans", sub: "Reads files, chooses the tools" },
  { n: "3", title: "The agent calls Norba", sub: "Search, price, seats, bags" },
  { n: "4", title: "Norba asks the airlines", sub: "Live, over NDC" },
  { n: "5", title: "Offers stream back", sub: "Into the chat as they arrive" },
  { n: "6", title: "You pay, it books", sub: "The order is made with the airline" },
  { n: "7", title: "The airline moves a flight", sub: "Webhook → new flights, one tap" },
  { n: "A", title: "Agency desk", sub: "Muse Spark Open drafts the reply" },
  { n: "B", title: "Any AI assistant", sub: "MCP: search, price, checkout link" },
] as const;
