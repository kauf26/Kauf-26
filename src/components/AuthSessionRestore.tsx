import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * After OAuth login, silently restore encrypted marketplace browser sessions.
 * Skipped for users still in the first-time setup wizard.
 */
export default function AuthSessionRestore() {
  const { user, isAuthenticated } = useAuth();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || user.needsOnboarding) return;
    if (restoredRef.current) return;
    restoredRef.current = true;

    fetch("/api/onboarding/restore-sessions", {
      method: "POST",
      credentials: "include",
    }).catch((err) => {
      console.warn("[AuthSessionRestore]", err);
    });
  }, [isAuthenticated, user]);

  return null;
}
