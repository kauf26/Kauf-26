import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, ChevronDown, ChevronRight, CheckCircle2, Circle, ExternalLink, Save, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { MarketplaceStatusCard, type MarketplaceVerifyStatus } from "@/components/MarketplaceStatusCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";

interface MarketplaceField {
  key: string;
  label: string;
  placeholder: string;
  helpUrl?: string;
  secret?: boolean;
}

interface MarketplaceDef {
  id: string;
  name: string;
  color: string;
  country: string;
  signupUrl: string;
  devUrl: string;
  fields: MarketplaceField[];
}

const OAUTH_PLATFORM_IDS = new Set(["etsy", "shopify", "ebay"]);

const OAUTH_PLATFORM_LABELS: Record<string, string> = {
  etsy: "Etsy",
  shopify: "Shopify",
  ebay: "eBay",
};

function mp(
  id: string,
  name: string,
  country: string,
  devUrl: string,
  signupUrl: string,
  color = "text-zinc-300",
  fields: MarketplaceField[] = [
    {
      key: "apiKey",
      label: "API Key",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
      secret: true,
    },
  ]
): MarketplaceDef {
  return { id, name, color, country, signupUrl, devUrl, fields };
}

const MARKETPLACES: MarketplaceDef[] = [
  mp("aliexpress", "AliExpress", "🇨🇳 China", "https://open.aliexpress.com", "https://open.aliexpress.com"),
  {
    id: "allegro",
    name: "Allegro",
    color: "text-orange-400",
    country: "🇵🇱 Poland",
    signupUrl: "https://allegro.pl",
    devUrl: "https://developer.allegro.pl",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "ebay",
    name: "eBay",
    color: "text-yellow-400",
    country: "🇺🇸 United States",
    signupUrl: "https://www.ebay.com/join",
    devUrl: "https://developer.ebay.com",
    fields: [],
  },
  {
    id: "amazon",
    name: "Amazon (SP-API)",
    color: "text-orange-400",
    country: "🇺🇸 United States",
    signupUrl: "https://sell.amazon.com",
    devUrl: "https://developer.amazonservices.com",
    fields: [
      { key: "sellerId", label: "Seller ID", placeholder: "AXXXXXXXXXXXXX", helpUrl: "https://sellercentral.amazon.com/sw/AccountInfo/MerchantToken" },
      { key: "clientId", label: "LWA Client ID", placeholder: "amzn1.application-oa2-client.XXXX", helpUrl: "https://developer.amazonservices.com" },
      { key: "clientSecret", label: "LWA Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "refreshToken", label: "Refresh Token", placeholder: "Atzr|XXXXXX", secret: true },
    ],
  },
  {
    id: "etsy",
    name: "Etsy",
    color: "text-orange-300",
    country: "🇺🇸 United States",
    signupUrl: "https://www.etsy.com/join",
    devUrl: "https://www.etsy.com/developers",
    fields: [],
  },
  {
    id: "shopify",
    name: "Shopify",
    color: "text-green-400",
    country: "🇨🇦 Canada",
    signupUrl: "https://www.shopify.com",
    devUrl: "https://partners.shopify.com",
    fields: [],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    color: "text-purple-400",
    country: "🇺🇸 United States",
    signupUrl: "https://woocommerce.com",
    devUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs",
    fields: [
      { key: "siteUrl", label: "Store URL", placeholder: "https://yourstore.com" },
      { key: "consumerKey", label: "Consumer Key", placeholder: "ck_xxxxxxxxxxxxxxxx" },
      { key: "consumerSecret", label: "Consumer Secret", placeholder: "cs_xxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  mp(
    "bigcommerce",
    "BigCommerce",
    "🌍 Global",
    "https://developer.bigcommerce.com",
    "https://www.bigcommerce.com"
  ),
  {
    id: "bolcom",
    name: "Bol.com",
    color: "text-blue-500",
    country: "🇳🇱 Netherlands",
    signupUrl: "https://www.bol.com/nl/rnwy/account/verkopen-op-bol/introductie",
    devUrl: "https://developers.bol.com",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  mp("depop", "Depop", "🇬🇧 UK / 🇺🇸 USA", "https://www.depop.com/developers", "https://www.depop.com"),
  {
    id: "stockx",
    name: "StockX",
    color: "text-green-300",
    country: "🇺🇸 United States",
    signupUrl: "https://stockx.com/sell",
    devUrl: "https://stockx.com/developer",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", helpUrl: "https://stockx.com/developer", secret: true },
      { key: "email", label: "Account Email", placeholder: "you@example.com" },
    ],
  },
  mp("flipkart", "Flipkart", "🇮🇳 India", "https://developer.flipkart.net", "https://www.flipkart.com"),
  mp("fruugo", "Fruugo", "🇪🇺 Europe", "https://developer.fruugo.com", "https://www.fruugo.com"),
  mp("lazada", "Lazada", "🌏 Southeast Asia", "https://open.lazada.com", "https://www.lazada.com"),
  mp("magento", "Magento (Adobe Commerce)", "🌍 Global", "https://developer.adobe.com/commerce", "https://business.adobe.com/products/magento/magento-commerce.html"),
  {
    id: "mercadolibre",
    name: "MercadoLibre",
    color: "text-yellow-300",
    country: "🇲🇽 Latin America (Mexico, Brazil, Argentina & more)",
    signupUrl: "https://www.mercadolibre.com",
    devUrl: "https://developers.mercadolibre.com",
    fields: [
      { key: "clientId", label: "Client ID (App ID)", placeholder: "XXXXXXXXXX" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "APP_USR-XXXX", secret: true },
    ],
  },
  {
    id: "mercadolibre_br",
    name: "Mercado Livre (Brazil)",
    color: "text-yellow-400",
    country: "🇧🇷 Brazil",
    signupUrl: "https://www.mercadolivre.com.br",
    devUrl: "https://developers.mercadolivre.com.br",
    fields: [
      { key: "clientId", label: "Client ID (App ID)", placeholder: "XXXXXXXXXX" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "APP_USR-XXXX", secret: true },
    ],
  },
  mp("newegg", "Newegg", "🇺🇸 United States", "https://developer.newegg.com", "https://www.newegg.com"),
  {
    id: "tiktokshop",
    name: "TikTok Shop",
    color: "text-cyan-400",
    country: "🌏 Global",
    signupUrl: "https://seller-us.tiktok.com",
    devUrl: "https://partner.tiktokshop.com",
    fields: [
      { key: "appKey", label: "App Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", helpUrl: "https://partner.tiktokshop.com/doc/page/63" },
      { key: "appSecret", label: "App Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "poshmark",
    name: "Poshmark",
    color: "text-rose-400",
    country: "🇺🇸 United States",
    signupUrl: "https://poshmark.com/signup",
    devUrl: "https://poshmark.com/developer",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", helpUrl: "https://poshmark.com/developer" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  mp("rakuten", "Rakuten", "🇯🇵 Japan", "https://webservice.rakuten.co.jp", "https://www.rakuten.co.jp"),
  {
    id: "vinted",
    name: "Vinted",
    color: "text-teal-300",
    country: "🇪🇺 Europe",
    signupUrl: "https://www.vinted.com/signup",
    devUrl: "https://vinted.com",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", helpUrl: "https://vinted.com" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "shopee",
    name: "Shopee",
    color: "text-orange-500",
    country: "🇧🇷 Brazil / 🌏 Southeast Asia",
    signupUrl: "https://seller.shopee.com.br/signup",
    devUrl: "https://open.shopee.com",
    fields: [
      { key: "partnerId", label: "Partner ID", placeholder: "000000", helpUrl: "https://open.shopee.com/developer-guide/1" },
      { key: "partnerKey", label: "Partner Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "shopId", label: "Shop ID", placeholder: "000000" },
    ],
  },
  mp("taobao", "Taobao", "🇨🇳 China", "https://open.taobao.com", "https://www.taobao.com"),
  mp("wayfair", "Wayfair", "🇺🇸 United States", "https://developer.wayfair.com", "https://www.wayfair.com"),
  mp("zalando", "Zalando", "🇩🇪 Germany", "https://partner.zalando.com", "https://www.zalando.com"),
];

function MarketplaceCard({ def, savedCreds }: { def: MarketplaceDef; savedCreds: Record<string, string> | null }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(savedCreds || {});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isConnected = savedCreds !== null && Object.keys(savedCreds).length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/marketplace-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace: def.id, credentials: values }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${def.name} credentials saved.` });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace-credentials"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save credentials.", variant: "destructive" });
    },
  });

  const allFilled = def.fields.every((f) => values[f.key]?.trim());

  return (
    <Card className={`overflow-hidden transition-all ${isConnected ? "border-green-500/30" : ""}`}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          {isConnected
            ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />}
          <div>
            <span className={`font-semibold ${def.color}`}>{def.name}</span>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{def.country}</p>
          </div>
          {isConnected && <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Connected</span>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <CardContent className="pt-0 pb-5 space-y-4 border-t">
          <div className="pt-4 flex gap-3 text-sm">
            <a href={def.signupUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="w-3 h-3" /> Create account
            </a>
            <span className="text-muted-foreground">·</span>
            <a href={def.devUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="w-3 h-3" /> Get API credentials
            </a>

            {def.id === "shopify" && (savedCreds?.storeUrl || values.storeUrl) && (
              <>
                <span className="text-muted-foreground">·</span>
                <a
                  href={`https://${savedCreds?.storeUrl || values.storeUrl}/admin/apps`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Open Shopify App Config
                </a>
              </>
            )}
          </div>

          <div className="space-y-3">
            {def.fields.map((field) => (
              <div key={field.key}>
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor={`${def.id}-${field.key}`} className="text-sm">{field.label}</Label>
                  {field.helpUrl && (
                    <a href={field.helpUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline">Where to find this</a>
                  )}
                </div>
                <Input
                  id={`${def.id}-${field.key}`}
                  type={field.secret ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  data-testid={`input-${def.id}-${field.key}`}
                />
              </div>
            ))}
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!allFilled || saveMutation.isPending}
            className="w-full"
            data-testid={`button-save-${def.id}`}
          >
            {saveMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4 mr-2" /> Save {def.name} Credentials</>}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

const VERIFIABLE_MARKETPLACES = ["shopify", "etsy", "ebay"] as const;

function MarketplaceStatusSection() {
  const [statuses, setStatuses] = useState<MarketplaceVerifyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopifyShop, setShopifyShop] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const marketplace = params.get("marketplace");
    if (connected === "true" && marketplace) {
      toast({
        title: "Connected",
        description: `${OAUTH_PLATFORM_LABELS[marketplace] ?? marketplace} account linked successfully.`,
      });
      window.history.replaceState({}, "", "/settings");
    } else if (connected === "false" && marketplace) {
      const reason = params.get("reason");
      toast({
        title: "Connection failed",
        description: reason ?? `Could not connect ${marketplace}.`,
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        VERIFIABLE_MARKETPLACES.map(async (id): Promise<MarketplaceVerifyStatus> => {
          try {
            const res = await fetch(`/api/${id}/verify`);
            const json = await res.json();
            const authorizeUrl =
              typeof json.authorizeUrl === "string"
                ? json.authorizeUrl
                : typeof json.detail?.authorizeUrl === "string"
                  ? json.detail.authorizeUrl
                  : `/api/${id}/oauth/start`;
            return {
              marketplace: json.marketplace ?? id,
              ok: json.ok === true,
              configured: json.configured === true,
              status: typeof json.status === "number" ? json.status : res.status,
              message: json.message ?? "No response from verification endpoint.",
              hint: json.hint,
              authorizeUrl: json.ok ? undefined : authorizeUrl,
              connectLabel: `Connect with ${OAUTH_PLATFORM_LABELS[id] ?? id}`,
            };
          } catch {
            return {
              marketplace: id,
              ok: false,
              configured: false,
              status: 0,
              message: "Could not reach the server to verify this connection.",
              hint: "Make sure the backend is running, then reload this page.",
              authorizeUrl: `/api/${id}/oauth/start`,
              connectLabel: `Connect with ${OAUTH_PLATFORM_LABELS[id] ?? id}`,
            };
          }
        })
      );
      if (!cancelled) {
        setStatuses(results);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Connect Marketplaces (OAuth)
      </h2>
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/10 px-4 py-6 justify-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking marketplace connections…
        </div>
      ) : (
        <div className="space-y-3">
          {statuses.map((status) => {
            const shopifyConnectUrl =
              shopifyShop.trim().length > 0
                ? `/api/shopify/oauth/start?shop=${encodeURIComponent(shopifyShop.trim())}`
                : undefined;
            const cardStatus: MarketplaceVerifyStatus =
              status.marketplace === "shopify" && !status.ok
                ? {
                    ...status,
                    authorizeUrl: shopifyConnectUrl,
                    connectLabel: shopifyConnectUrl
                      ? status.connectLabel
                      : undefined,
                  }
                : status;

            return (
              <div key={status.marketplace}>
                <MarketplaceStatusCard status={cardStatus} />
                {status.marketplace === "shopify" && !status.ok && (
                  <div className="mt-2 px-1">
                    <Label htmlFor="shopify-shop-domain" className="text-xs text-muted-foreground">
                      Shopify store domain
                    </Label>
                    <Input
                      id="shopify-shop-domain"
                      className="mt-1"
                      placeholder="your-store.myshopify.com"
                      value={shopifyShop}
                      onChange={(e) => setShopifyShop(e.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteAccountSection() {
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { logout } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
    },
    onSuccess: () => {
      toast({ title: "Account deleted", description: "All your data has been permanently removed." });
      setTimeout(() => logout(), 1500);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete your account. Please try again.", variant: "destructive" });
    },
  });

  const canDelete = confirmText === "DELETE";

  return (
    <div className="mt-12 pt-8 border-t border-destructive/20">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Delete Account
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Permanently delete your account and all associated data — listings, sales, credentials, and settings. This cannot be undone.
        </p>
      </div>

      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            className="gap-2"
            data-testid="button-delete-account-open"
          >
            <Trash2 className="w-4 h-4" />
            Delete My Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                This will permanently delete <strong>all</strong> of your data, including:
              </span>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>All product listings and photos</li>
                <li>All sales records and fee history</li>
                <li>All marketplace credentials</li>
                <li>Your account and trial status</li>
              </ul>
              <span className="block font-medium text-foreground">
                To confirm, type DELETE in the box below:
              </span>
              <Input
                placeholder="Type DELETE to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="mt-1 font-mono"
                data-testid="input-delete-confirm"
                autoCapitalize="characters"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (canDelete) deleteMutation.mutate();
              }}
              disabled={!canDelete || deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</>
              ) : (
                "Delete Everything"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  const { data: allCreds = [] } = useQuery<{ marketplace: string; credentials: string }[]>({
    queryKey: ["/api/marketplace-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace-credentials");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const credsByMarketplace: Record<string, Record<string, string>> = {};
  for (const row of allCreds) {
    try { credsByMarketplace[row.marketplace] = JSON.parse(row.credentials); } catch {}
  }

  const connectedCount = Object.keys(credsByMarketplace).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Marketplace Connections</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Connect your marketplace accounts so the app can submit listings on your behalf.
          </p>
        </div>

        <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong className="text-foreground">Etsy, Shopify, and eBay use secure OAuth.</strong> Click the connect button for each platform — you will be redirected to sign in and approve access. Tokens are stored encrypted on the server and never shown here.</p>
                <p>For other marketplaces, enter API credentials from their developer portal once you have a seller account.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <MarketplaceStatusSection />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {connectedCount} of {MARKETPLACES.length} marketplaces connected
          </h2>
          <div className="flex gap-1">
            {MARKETPLACES.map((m) => (
              <div key={m.id}
                className={`w-2 h-2 rounded-full ${credsByMarketplace[m.id] ? "bg-green-400" : "bg-muted"}`}
                title={m.name}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {MARKETPLACES.filter((def) => !OAUTH_PLATFORM_IDS.has(def.id)).map((def) => (
            <MarketplaceCard
              key={def.id}
              def={def}
              savedCreds={credsByMarketplace[def.id] || null}
            />
          ))}
        </div>

        <DeleteAccountSection />
      </div>
    </div>
  );
}
