import { useEffect } from "react";
import { useLocation } from "wouter";
import { ShoppingBag, LogIn, Chrome, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Global Lister</h1>
          <p className="text-muted-foreground">
            Sign in to list your products across every marketplace — instantly.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleLogin}
            size="lg"
            className="w-full text-base gap-3"
            data-testid="button-login-google"
          >
            <LogIn className="w-5 h-5" />
            Continue with Google, Apple or Email
          </Button>

          <p className="text-xs text-muted-foreground">
            Supports Google, Apple, GitHub, and email/password sign-in.
          </p>
        </div>

        <div className="border-t pt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            List products on eBay, Amazon, Etsy, Shopify, Reverb and 8 more marketplaces.
          </p>
          <p className="text-xs text-muted-foreground">
            30-day free trial · No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
