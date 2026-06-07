import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import FirstTimeSetupWizard from "@/components/FirstTimeSetupWizard";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
      return;
    }
    if (!isLoading && user && !user.needsOnboarding && user.onboardingCompleted) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <FirstTimeSetupWizard
      onComplete={() => setLocation("/")}
    />
  );
}
