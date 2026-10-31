"use client";

import { useEffect, useState } from "react";

/** The board's own clock, ticking: rendered in the browser so it shows the local time where it is filmed. */
export function BoardClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);
  return <p className="text-[3vw] font-semibold tabular-nums">{now}</p>;
}
