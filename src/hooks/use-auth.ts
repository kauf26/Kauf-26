import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@shared/models/auth";

const webOAuthEnabled = import.meta.env.VITE_WEB_OAUTH_ENABLED === "true";

async function fetchUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    enabled: webOAuthEnabled,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user: webOAuthEnabled ? user : null,
    isLoading: webOAuthEnabled ? isLoading : false,
    isAuthenticated: webOAuthEnabled ? !!user : false,
    webOAuthEnabled,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
