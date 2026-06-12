import { useEffect, useState } from "react";
import { getTrialBannerText } from "../../shared/trialStatus";
import { fetchTrialStatus } from "@/lib/trialStatus";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  fallbackText?: string;
};

export function TrialBanner({
  className,
  fallbackText = "14 DAY FREE TRIAL",
}: Props) {
  const [text, setText] = useState<string | null>(fallbackText);

  useEffect(() => {
    let cancelled = false;
    void fetchTrialStatus().then((status) => {
      if (cancelled) return;
      if (!status) {
        setText(fallbackText);
        return;
      }
      if (status.expired || !status.isActive) {
        setText(null);
        return;
      }
      setText(getTrialBannerText(status));
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackText]);

  if (!text) return null;

  return (
    <p className={cn("font-bold uppercase text-gray-700 text-center tracking-widest", className)}>
      {text}
    </p>
  );
}
