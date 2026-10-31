import "server-only";

import { norbaMode } from "../config";
import { liveNorba } from "./live";
import { mockNorba } from "./mock";

export { NorbaError } from "./port";
export type { NorbaPort, SearchResult } from "./port";

/** The Norba client this process uses: live with a key, the mock without one. */
export const norba = () => (norbaMode() === "live" ? liveNorba : mockNorba);
