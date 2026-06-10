import { useEffect, useState } from "react";
import { waitForBackendReady } from "@/lib/stableFetch";

export function useBackendReady() {
  const [state, setState] = useState<"checking" | "ready" | "unavailable">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;

    void waitForBackendReady().then((ok) => {
      if (!cancelled) {
        setState(ok ? "ready" : "unavailable");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    checking: state === "checking",
    ready: state === "ready",
    unavailable: state === "unavailable",
  };
}
