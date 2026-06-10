import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useProductDraft } from "@/ProductDraftContext";
import { resetListingFlow } from "@/lib/resetListingFlow";

type PublishOutcome = {
  marketplace: string;
  success: boolean;
  listingId?: string;
  listingUrl?: string;
  account?: string;
  message: string;
  dryRun?: boolean;
  error?: string;
};

type PublishReport = {
  draftId?: number;
  jobId?: number;
  title?: string;
  marketplaces?: string[];
  outcomes?: PublishOutcome[];
  succeeded?: number;
  failed?: number;
  dryRun?: number;
};

function loadReport(): PublishReport | null {
  try {
    const raw = sessionStorage.getItem("publishReport");
    return raw ? (JSON.parse(raw) as PublishReport) : null;
  } catch {
    return null;
  }
}

function outcomeBadge(o: PublishOutcome) {
  if (!o.success) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-600/20 border border-red-700/50 px-2.5 py-0.5 text-xs font-semibold text-red-300">
        Failed
      </span>
    );
  }
  if (o.dryRun) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-600/20 border border-amber-700/50 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
        Dry Run
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-600/20 border border-emerald-700/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
      Published
    </span>
  );
}

const PublishConfirmation: React.FC = () => {
  const [, setLocation] = useLocation();
  const { clearDraft } = useProductDraft();
  const [report, setReport] = useState<PublishReport | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setReport(loadReport());
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!report || !report.outcomes || report.outcomes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 my-10 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 space-y-4 text-center">
        <h1 className="text-xl font-bold">No publish results found</h1>
        <p className="text-sm text-zinc-400">
          It looks like you haven't published a listing in this session yet.
        </p>
        <button
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          onClick={() => setLocation("/create")}
        >
          Create a Listing
        </button>
      </div>
    );
  }

  const outcomes = report.outcomes;
  const published = outcomes.filter((o) => o.success && !o.dryRun).length;
  const dryRun = outcomes.filter((o) => o.success && o.dryRun).length;
  const failed = outcomes.filter((o) => !o.success).length;

  const handleListAnotherItem = () => {
    resetListingFlow({ clearDraftContext: clearDraft });
    setLocation("/");
  };

  return (
    <div className="max-w-3xl mx-auto p-6 my-6 space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">
          {failed === 0 ? "🎉 Listing Published" : "Publish Results"}
        </h1>
        {report.title && (
          <p className="text-sm text-zinc-400">
            <span className="text-zinc-500">Item:</span>{" "}
            <span className="font-medium text-zinc-200">{report.title}</span>
            {report.draftId != null && (
              <span className="text-zinc-600"> · Draft #{report.draftId}</span>
            )}
          </p>
        )}
        <div className="flex gap-4 text-sm pt-1">
          <span className="text-emerald-400 font-medium">{published} published</span>
          <span className="text-amber-400 font-medium">{dryRun} dry-run</span>
          <span className={failed > 0 ? "text-red-400 font-medium" : "text-zinc-500"}>
            {failed} failed
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {outcomes.map((o) => (
          <div
            key={o.marketplace}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-100 capitalize">
                {o.marketplace}
              </h2>
              {outcomeBadge(o)}
            </div>

            <p className="text-sm text-zinc-400 break-words">{o.message}</p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {o.account && (
                <div>
                  <dt className="text-zinc-600">Account</dt>
                  <dd className="text-zinc-300 font-medium">{o.account}</dd>
                </div>
              )}
              {o.listingId && (
                <div>
                  <dt className="text-zinc-600">Listing ID</dt>
                  <dd className="text-zinc-300 font-mono">{o.listingId}</dd>
                </div>
              )}
            </dl>

            {o.listingUrl && (
              <a
                href={o.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                View Live Listing ↗
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          className="flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
          onClick={() => setLocation("/dashboard")}
        >
          Go to Dashboard
        </button>
        <button
          className="flex-1 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          onClick={handleListAnotherItem}
        >
          List Another Item
        </button>
      </div>
    </div>
  );
};

export default PublishConfirmation;
