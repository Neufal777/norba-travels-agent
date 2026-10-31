"use client";

import { useEffect, useState } from "react";
import type { AppStatus } from "@/lib/types";

/** Which brain answers and which Norba environment searches reach, read once per page load. */
export function useStatus() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);
  return status;
}
