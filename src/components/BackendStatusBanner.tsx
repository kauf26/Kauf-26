import { Loader2 } from "lucide-react";
import { useBackendReady } from "@/hooks/use-backend-ready";

export default function BackendStatusBanner() {
  const { checking, unavailable } = useBackendReady();

  if (!checking && !unavailable) {
    return null;
  }

  return (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100"
      role="status"
    >
      {checking ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Backend starting…
        </span>
      ) : (
        "Backend unavailable — dashboard data may be incomplete."
      )}
    </div>
  );
}
