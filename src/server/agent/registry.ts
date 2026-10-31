import "server-only";

import { BOOKING_TOOLS, bookTrip } from "./booking-tools";
import { SERVICING_TOOLS, changeFlight } from "./servicing-tools";
import { SHOPPING_TOOLS, type Tool } from "./tools";

/** Every tool the model may call. `book_trip` and `change_flight` are not among them: the Pay and Switch buttons run them. */
export const TOOLS: Tool[] = [...SHOPPING_TOOLS, ...BOOKING_TOOLS, ...SERVICING_TOOLS];

export const toolByName = (name: string) => [...TOOLS, bookTrip, changeFlight].find((t) => t.schema.function.name === name);
