import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@shared/models/auth";

const webOAuthEnabled = import.meta.env.VITE_WEB_OAUTH_ENABLED === "true";
const devLoginEnabled = import.meta.env.VITE_DEV_LOGIN_ENABLED === "true";
const authEnabled = webOAuthEnabled || devLoginEnabled;

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
    enabled: authEnabled,
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
    user: authEnabled ? user : null,
    isLoading: authEnabled ? isLoading : false,
    isAuthenticated: authEnabled ? !!user : false,
    webOAuthEnabled,
    devLoginEnabled,
    authEnabled,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
