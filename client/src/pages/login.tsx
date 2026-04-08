import { useEffect } from "react";
import { useLocation } from "wouter";
import { ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.18 1.28-2.16 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.77M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function ReplitIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M4 4h7v4H8v4H4V4zm7 8h4v4h-4v4H4v-4h7v-4zm4-8h5v16h-5v-4h4V8h-4V4z"/>
    </svg>
  );
}

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  const errorMessage =
    error === "replit-proxy"
      ? "Replit login only works in the Replit editor preview pane — not on the published URL."
      : error
      ? "Sign-in failed. Please try again."
      : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">

        {/* Logo + title */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Global Lister</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to list your products across every marketplace — instantly.
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Sign-in buttons */}
        <div className="space-y-3">
          {/* Sign in with Apple — must be dark per Apple HIG */}
          <a
            href="/api/auth/apple"
            data-testid="button-login-apple"
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white text-black px-5 py-3.5 text-sm font-semibold shadow-sm hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <AppleIcon />
            Sign in with Apple
          </a>

          {/* Sign in with Google */}
          <a
            href="/api/auth/google"
            data-testid="button-login-google"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-card px-5 py-3.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/50 active:bg-muted transition-colors"
          >
            <GoogleIcon />
            Sign in with Google
          </a>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Continue with Replit — works in the Replit editor preview pane */}
          <a
            href="/api/auth/replit"
            data-testid="button-login-replit"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-5 py-3.5 text-sm font-semibold text-orange-400 hover:bg-orange-500/20 active:bg-orange-500/30 transition-colors"
          >
            <ReplitIcon />
            Continue with Replit
          </a>
          <p className="text-xs text-muted-foreground -mt-1">
            Use this button inside the Replit editor preview to test the app
          </p>
        </div>

        {/* Fine print */}
        <div className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground">
            By signing in you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </div>

        {/* Value prop */}
        <div className="border-t pt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            List on eBay, Amazon, Etsy, Shopify, StockX, Poshmark, Mercari, TikTok Shop, Shopee, Vinted, Wallapop, Bol.com, and more — across 26 marketplaces worldwide.
          </p>
          <p className="text-xs text-muted-foreground">
            30-day free trial · No credit card required · 2% per sale after trial
          </p>
        </div>
      </div>
    </div>
  );
}
