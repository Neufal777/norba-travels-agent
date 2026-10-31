import "server-only";

import { BOOKING_TOOLS, bookTrip } from "./booking-tools";
import { GROUP_TOOLS, holdGroup } from "./group";
import { SERVICING_TOOLS, changeFlight } from "./servicing-tools";
import { SHOPPING_TOOLS, type Tool } from "./tools";

/** Every tool the model may call. `book_trip`, `change_flight` and `hold_group` are not among them: buttons run them. */
export const TOOLS: Tool[] = [...SHOPPING_TOOLS, ...GROUP_TOOLS, ...BOOKING_TOOLS, ...SERVICING_TOOLS];

export const toolByName = (name: string) => [...TOOLS, bookTrip, changeFlight, holdGroup].find((t) => t.schema.function.name === name);
