import "server-only";

import { BOOKING_TOOLS, bookTrip } from "./booking-tools";
import { SHOPPING_TOOLS, type Tool } from "./tools";

/** Every tool the model may call. `book_trip` is not among them: the Pay button runs it. */
export const TOOLS: Tool[] = [...SHOPPING_TOOLS, ...BOOKING_TOOLS];

export const toolByName = (name: string) => [...TOOLS, bookTrip].find((t) => t.schema.function.name === name);
