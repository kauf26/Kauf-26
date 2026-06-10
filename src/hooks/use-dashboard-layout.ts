import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DASHBOARD_LAYOUT_QUERY_KEY,
  fetchDashboardLayout,
  saveDashboardLayout,
  type DashboardLayoutRecord,
} from "@/lib/dashboardLayoutFetch";
import { STABLE_QUERY_OPTIONS } from "@/lib/stableFetch";

type UseDashboardLayoutOptions = {
  enabled?: boolean;
};

export function useDashboardLayout(options: UseDashboardLayoutOptions = {}) {
  const { enabled = true } = options;

  return useQuery<DashboardLayoutRecord>({
    queryKey: DASHBOARD_LAYOUT_QUERY_KEY,
    queryFn: fetchDashboardLayout,
    enabled,
    ...STABLE_QUERY_OPTIONS,
  });
}

export function useSaveDashboardLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveDashboardLayout,
    onSuccess: (data) => {
      queryClient.setQueryData(DASHBOARD_LAYOUT_QUERY_KEY, data);
    },
  });
}
