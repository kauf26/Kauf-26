import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link2, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OAuthConnection = {
  marketplace: string;
  provider?: string;
  configured: boolean;
  connected: boolean;
  accountLabel: string | null;
  shopDomain: string | null;
};

const PLATFORM_LABELS: Record<string, string> = {
  etsy: "Etsy",
  ebay: "eBay",
  shopify: "Shopify",
  amazon: "Amazon",
};

const PLATFORM_COLORS: Record<string, string> = {
  etsy: "text-orange-300",
  ebay: "text-yellow-400",
  shopify: "text-green-400",
  amazon: "text-amber-400",
};

export default function ConnectedAccounts() {
  const { toast } = useToast();
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopDomain, setShopDomain] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/connections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load connections");
      const data = (await res.json()) as {
        connections?: OAuthConnection[];
        mockMode?: boolean;
      };
      setConnections(data.connections ?? []);
      setMockMode(Boolean(data.mockMode));
    } catch (error) {
      toast({
        title: "Could not load connections",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConnections();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const marketplace = params.get("marketplace");
    if (connected === "true" && marketplace) {
      toast({
        title: "Connected",
        description: `${PLATFORM_LABELS[marketplace] ?? marketplace} account linked successfully.`,
      });
      window.history.replaceState({}, "", "/settings");
      void loadConnections();
    } else if (connected === "false" && marketplace) {
      toast({
        title: "Connection failed",
        description: params.get("reason") ?? `Could not connect ${marketplace}.`,
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, [toast]);

  const openConnect = (marketplace: string) => {
    if (marketplace === "shopify" && !shopDomain.trim()) {
      toast({
        title: "Shop domain required",
        description: "Enter your Shopify store domain (e.g. mystore.myshopify.com).",
        variant: "destructive",
      });
      return;
    }

    const params = new URLSearchParams({ returnTo: "web", redirect: "1" });
    if (marketplace === "shopify") {
      params.set("shop", shopDomain.trim());
    }

    const authStartUrl = `/api/auth/${marketplace}/url?${params.toString()}`;
    const popup = window.open(authStartUrl, `${marketplace}-oauth`, "width=520,height=720");

    if (!popup) {
      window.location.href = authStartUrl;
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        void loadConnections();
      }
    }, 800);
  };

  const disconnect = async (marketplace: string) => {
    setBusy(marketplace);
    try {
      const res = await fetch(`/api/auth/${marketplace}/revoke`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Disconnect failed");
      toast({
        title: "Disconnected",
        description: `${PLATFORM_LABELS[marketplace] ?? marketplace} unlinked.`,
      });
      await loadConnections();
    } catch (error) {
      toast({
        title: "Disconnect failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-4 py-6 justify-center text-sm text-muted-foreground mb-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading connected accounts…
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Connected Accounts
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect Etsy, eBay, Shopify, and Amazon. Tokens are encrypted on the server and never
          shown in the UI.
          {mockMode ? " Mock OAuth mode is enabled for development." : null}
        </p>
      </div>

      {connections.map((conn) => (
        <Card key={conn.marketplace} className={conn.connected ? "border-green-500/30" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-lg ${PLATFORM_COLORS[conn.marketplace] ?? ""}`}>
              {PLATFORM_LABELS[conn.marketplace] ?? conn.marketplace}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!conn.configured ? (
              <p className="text-sm text-muted-foreground">
                Server OAuth is not configured. Add client credentials to `.env` and restart the
                backend.
              </p>
            ) : conn.connected ? (
              <p className="text-sm text-muted-foreground">
                Connected{conn.accountLabel ? ` as ${conn.accountLabel}` : ""}
                {conn.shopDomain ? ` · ${conn.shopDomain}` : ""}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not connected</p>
            )}

            {conn.marketplace === "shopify" && !conn.connected && conn.configured ? (
              <div>
                <Label htmlFor="shop-domain">Shop domain</Label>
                <Input
                  id="shop-domain"
                  placeholder="mystore.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void openConnect(conn.marketplace)}
                disabled={!conn.configured || conn.connected || busy === conn.marketplace}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Connect {PLATFORM_LABELS[conn.marketplace] ?? conn.marketplace}
              </Button>
              {conn.connected ? (
                <Button
                  variant="outline"
                  onClick={() => void disconnect(conn.marketplace)}
                  disabled={busy === conn.marketplace}
                >
                  {busy === conn.marketplace ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
