import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "global_lister_gdpr_consent";

export default function GdprBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consented = localStorage.getItem(STORAGE_KEY);
    if (!consented) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:bottom-4 md:left-4 md:right-auto md:max-w-sm bg-card border border-white/10 shadow-xl rounded-t-2xl md:rounded-2xl p-5"
      role="dialog"
      aria-label="Privacy consent notice"
      data-testid="gdpr-banner"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-foreground">Your Privacy</p>
        <button
          onClick={accept}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
          data-testid="gdpr-banner-dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        We use session cookies to keep you logged in and store your preferences locally on your device. Your product photos are processed by OpenAI to generate listing descriptions. We do not sell your data or use advertising trackers.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={accept}
          className="flex-1 min-w-fit"
          data-testid="gdpr-banner-accept"
        >
          Got it
        </Button>
        <Link href="/privacy">
          <Button
            variant="ghost"
            size="sm"
            onClick={accept}
            className="text-xs text-muted-foreground"
            data-testid="gdpr-banner-learn-more"
          >
            Privacy Policy
          </Button>
        </Link>
      </div>
    </div>
  );
}
