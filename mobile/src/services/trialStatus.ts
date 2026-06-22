import { API_BASE_URL } from './config';
import type { TrialStatus } from '../../../shared/trialStatus';
import {
  clearTrialStatusCache as clearSharedTrialStatusCache,
  fetchTrialStatusFromUrl,
} from '../../../shared/trialStatusClient';

export type { TrialStatus };

export function clearTrialStatusCache(): void {
  clearSharedTrialStatusCache();
}

export async function fetchTrialStatus(options?: {
  forceRefresh?: boolean;
}): Promise<TrialStatus | null> {
  return fetchTrialStatusFromUrl(`${API_BASE_URL}/api/trial/status`, {
    forceRefresh: options?.forceRefresh,
  });
}
