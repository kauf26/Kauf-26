import { fetchJsonDeduped, fetchOptionalEndpoint } from "./stableFetch";

export type DashboardLayoutRecord = {
  layout: string | null;
};

export const DASHBOARD_LAYOUT_QUERY_KEY = ["dashboardLayout"] as const;

const EMPTY_LAYOUT: DashboardLayoutRecord = { layout: null };

export function fetchDashboardLayout(): Promise<DashboardLayoutRecord> {
  return fetchOptionalEndpoint(
    DASHBOARD_LAYOUT_QUERY_KEY.join("/"),
    "/api/dashboard/layout",
    EMPTY_LAYOUT
  );
}

export function saveDashboardLayout(layout: unknown): Promise<DashboardLayoutRecord> {
  return fetchJsonDeduped<DashboardLayoutRecord>(
    "dashboardLayout:save",
    "/api/dashboard/layout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    }
  );
}
