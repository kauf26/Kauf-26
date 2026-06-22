import type { TrialStatus } from "../../shared/trialStatus";
import {
  clearTrialStatusCache as clearSharedTrialStatusCache,
  fetchTrialStatusFromUrl,
} from "../../shared/trialStatusClient";

export type { TrialStatus };

export function clearTrialStatusCache(): void {
  clearSharedTrialStatusCache();
}

export async function fetchTrialStatus(options?: {
  forceRefresh?: boolean;
}): Promise<TrialStatus | null> {
  return fetchTrialStatusFromUrl("/api/trial/status", {
    forceRefresh: options?.forceRefresh,
    init: { credentials: "include" },
  });
}
