import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, ChevronDown, ChevronRight, CheckCircle2, Circle, ExternalLink, Save, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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
  signupUrl: string;
  devUrl: string;
  fields: MarketplaceField[];
}

const MARKETPLACES: MarketplaceDef[] = [
  {
    id: "ebay",
    name: "eBay",
    color: "text-yellow-400",
    signupUrl: "https://www.ebay.com/join",
    devUrl: "https://developer.ebay.com",
    fields: [
      { key: "appId", label: "App ID (Client ID)", placeholder: "YourApp-XXXX-XXXX-XXXX-XXXX", helpUrl: "https://developer.ebay.com/my/keys" },
      { key: "certId", label: "Cert ID (Client Secret)", placeholder: "YourCert-XXXX-XXXX-XXXX-XXXX", secret: true },
      { key: "userToken", label: "User OAuth Token", placeholder: "v^1.1#i^1#f^0#...", secret: true },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    color: "text-orange-400",
    signupUrl: "https://sell.amazon.com",
    devUrl: "https://developer.amazonservices.com",
    fields: [
      { key: "sellerId", label: "Seller ID", placeholder: "AXXXXXXXXXXXXX", helpUrl: "https://sellercentral.amazon.com/sw/AccountInfo/MerchantToken" },
      { key: "mwsAuthToken", label: "MWS Auth Token", placeholder: "amzn.mws.XXXXXXXX", secret: true },
      { key: "marketplaceId", label: "Marketplace ID", placeholder: "ATVPDKIKX0DER (US)" },
    ],
  },
  {
    id: "etsy",
    name: "Etsy",
    color: "text-orange-300",
    signupUrl: "https://www.etsy.com/join",
    devUrl: "https://www.etsy.com/developers",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", helpUrl: "https://www.etsy.com/developers/your-apps" },
      { key: "sharedSecret", label: "Shared Secret", placeholder: "xxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "OAuth Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    color: "text-green-400",
    signupUrl: "https://www.shopify.com",
    devUrl: "https://partners.shopify.com",
    fields: [
      { key: "storeUrl", label: "Store URL", placeholder: "your-store.myshopify.com" },
      { key: "apiKey", label: "API Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", helpUrl: "https://help.shopify.com/en/manual/apps/private-apps" },
      { key: "apiSecret", label: "API Secret", placeholder: "shpss_xxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "walmart",
    name: "Walmart",
    color: "text-blue-400",
    signupUrl: "https://marketplace.walmart.com",
    devUrl: "https://developer.walmart.com",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", helpUrl: "https://developer.walmart.com/doc/us/mp/auth" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "reverb",
    name: "Reverb",
    color: "text-teal-400",
    signupUrl: "https://reverb.com/signup",
    devUrl: "https://dev.reverb.com",
    fields: [
      { key: "apiKey", label: "Personal Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", helpUrl: "https://reverb.com/my/account/selling/api", secret: true },
    ],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    color: "text-purple-400",
    signupUrl: "https://woocommerce.com",
    devUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs",
    fields: [
      { key: "siteUrl", label: "Store URL", placeholder: "https://yourstore.com" },
      { key: "consumerKey", label: "Consumer Key", placeholder: "ck_xxxxxxxxxxxxxxxx" },
      { key: "consumerSecret", label: "Consumer Secret", placeholder: "cs_xxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    color: "text-red-400",
    signupUrl: "https://sell.aliexpress.com",
    devUrl: "https://developers.aliexpress.com",
    fields: [
      { key: "appKey", label: "App Key", placeholder: "XXXXXXXXXX" },
      { key: "appSecret", label: "App Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "sessionKey", label: "Session Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "mercadolibre",
    name: "Mercado Libre",
    color: "text-yellow-300",
    signupUrl: "https://www.mercadolibre.com",
    devUrl: "https://developers.mercadolibre.com",
    fields: [
      { key: "clientId", label: "Client ID (App ID)", placeholder: "XXXXXXXXXX" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "APP_USR-XXXX", secret: true },
    ],
  },
  {
    id: "rakuten",
    name: "Rakuten",
    color: "text-red-300",
    signupUrl: "https://www.rakuten.com/services/marketplace",
    devUrl: "https://webservice.rakuten.co.jp",
    fields: [
      { key: "serviceSecret", label: "Service Secret", placeholder: "xxxxxxxxxxxxxxxx", secret: true },
      { key: "licenseKey", label: "License Key", placeholder: "xxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    color: "text-blue-300",
    signupUrl: "https://www.bigcommerce.com",
    devUrl: "https://developer.bigcommerce.com",
    fields: [
      { key: "storeHash", label: "Store Hash", placeholder: "abc123xyz", helpUrl: "https://developer.bigcommerce.com/docs/start/authentication" },
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx" },
      { key: "accessToken", label: "Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    color: "text-indigo-400",
    signupUrl: "https://www.prestashop.com",
    devUrl: "https://devdocs.prestashop-project.org",
    fields: [
      { key: "storeUrl", label: "Store URL", placeholder: "https://yourstore.com" },
      { key: "apiKey", label: "API Key (Webservice Key)", placeholder: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", secret: true },
    ],
  },
  {
    id: "wish",
    name: "Wish",
    color: "text-pink-400",
    signupUrl: "https://merchant.wish.com/signup",
    devUrl: "https://merchant.wish.com/documentation/rest",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
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
          <span className={`font-semibold ${def.color}`}>{def.name}</span>
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
                <p><strong className="text-foreground">You must create your own account on each marketplace first.</strong> The app cannot create accounts for you — each platform requires identity verification, tax info, and a bank account.</p>
                <p>Once you have an account, get your API credentials from their developer portal and enter them below. Your credentials are stored securely and used only to submit your listings.</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
          {MARKETPLACES.map((def) => (
            <MarketplaceCard
              key={def.id}
              def={def}
              savedCreds={credsByMarketplace[def.id] || null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
