import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Smartphone, Store } from "lucide-react";
import type { OnboardingStatus } from "@shared/models/auth";

type Props = {
  onComplete: () => void;
};

async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const res = await fetch("/api/onboarding/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load onboarding status");
  return res.json();
}

const OAUTH_MARKETPLACES = [
  { id: "etsy", name: "Etsy", color: "text-orange-500" },
  { id: "shopify", name: "Shopify", color: "text-green-500" },
  { id: "ebay", name: "eBay", color: "text-red-500" },
] as const;

export default function FirstTimeSetupWizard({ onComplete }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"profile" | "mobile" | "done">("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["onboardingStatus"],
    queryFn: fetchOnboardingStatus,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to finish setup");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["onboardingStatus"] });
      setStep("done");
      onComplete();
    },
  });

  if (isLoading || !status) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Store className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Set up your seller profile</h1>
        <p className="text-sm text-muted-foreground">
          Connect marketplaces in the mobile app with one tap. We never ask for your marketplace
          password on the web.
        </p>
      </div>

      {step === "profile" && (
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              After you connect in the mobile app, name and email auto-fill from Etsy, Shopify, or
              eBay. You can enter or edit them here too.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <Button className="w-full" onClick={() => setStep("mobile")}>
              Continue
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              Skip for now
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "mobile" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              One-tap connect (mobile app)
            </CardTitle>
            <CardDescription>
              Open the <strong>Connections</strong> tab in the Kauf26 mobile app. If you&apos;re
              already logged into a marketplace in Safari (iOS) or Chrome (Android), tap once to
              connect — no password entry. OAuth tokens stay on your phone only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {OAUTH_MARKETPLACES.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <span className={`font-semibold ${m.color}`}>{m.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    Mobile app → Connections
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground leading-relaxed">
              iOS uses ASWebAuthenticationSession (Safari + Keychain). Android uses Chrome Custom
              Tabs. If you&apos;re not logged in on your phone, you&apos;ll sign in once in the
              system browser — we still never store your password.
            </p>
            <Button
              className="w-full"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finishing…
                </>
              ) : (
                "Finish setup"
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep("profile")}>
              Back to profile
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="font-medium">You&apos;re all set!</p>
            <p className="text-sm text-muted-foreground">
              Connect Etsy, Shopify, and eBay anytime from the mobile app Connections tab.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
