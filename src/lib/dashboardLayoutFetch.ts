import { fetchJsonDeduped, fetchJsonOrDefault } from "./stableFetch";

export type DashboardLayoutRecord = {
  layout: string | null;
};

export const DASHBOARD_LAYOUT_QUERY_KEY = ["dashboardLayout"] as const;

export function fetchDashboardLayout(): Promise<DashboardLayoutRecord> {
  return fetchJsonOrDefault(
    DASHBOARD_LAYOUT_QUERY_KEY.join("/"),
    "/api/dashboard/layout",
    { layout: null }
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
