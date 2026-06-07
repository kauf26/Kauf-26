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
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Store } from "lucide-react";
import type { OnboardingStatus } from "@shared/models/auth";

type Props = {
  onComplete: () => void;
};

type ConnectState = "idle" | "connecting" | "connected" | "error";

async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const res = await fetch("/api/onboarding/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load onboarding status");
  return res.json();
}

export default function FirstTimeSetupWizard({ onComplete }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"pick" | "credentials" | "done">("pick");
  const [selected, setSelected] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connectStates, setConnectStates] = useState<Record<string, ConnectState>>({});

  const { data: status, isLoading } = useQuery({
    queryKey: ["onboardingStatus"],
    queryFn: fetchOnboardingStatus,
  });

  const connectMutation = useMutation({
    mutationFn: async (marketplaceId: string) => {
      const res = await fetch("/api/onboarding/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaceId, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      return data;
    },
    onSuccess: (_data, marketplaceId) => {
      setConnectStates((s) => ({ ...s, [marketplaceId]: "connected" }));
      toast({ title: "Connected", description: `${marketplaceId} session saved securely.` });
    },
    onError: (err: Error, marketplaceId) => {
      setConnectStates((s) => ({ ...s, [marketplaceId]: "error" }));
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    },
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

  const marketplaces = status.availableMarketplaces;
  const currentId = selected[currentIndex];
  const currentName =
    marketplaces.find((m) => m.id === currentId)?.name ?? currentId;

  const toggleMarketplace = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConnectCurrent = async () => {
    if (!currentId || !email || !password) return;
    setConnectStates((s) => ({ ...s, [currentId]: "connecting" }));
    await connectMutation.mutateAsync(currentId);
    if (currentIndex < selected.length - 1) {
      setCurrentIndex((i) => i + 1);
      setPassword("");
    }
  };

  const skipCurrent = () => {
    if (currentIndex < selected.length - 1) {
      setCurrentIndex((i) => i + 1);
      setPassword("");
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Store className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Connect your marketplaces</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to each seller account once. Sessions are encrypted and stored for
          automatic login next time.
        </p>
      </div>

      {step === "pick" && (
        <Card>
          <CardHeader>
            <CardTitle>Choose marketplaces</CardTitle>
            <CardDescription>
              Select where you sell. You can add more later in Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {marketplaces.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={() => toggleMarketplace(m.id)}
                    className="h-4 w-4"
                  />
                  <span className="font-medium">{m.name}</span>
                  {status.connectedMarketplaces.includes(m.id) && (
                    <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
                  )}
                </label>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={selected.length === 0}
              onClick={() => {
                setCurrentIndex(0);
                setStep("credentials");
              }}
            >
              Continue ({selected.length} selected)
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => completeMutation.mutate()}
            >
              Skip for now
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "credentials" && currentId && (
        <Card>
          <CardHeader>
            <CardTitle>
              {currentName} ({currentIndex + 1} of {selected.length})
            </CardTitle>
            <CardDescription>
              Enter your seller login. We use a headless browser to sign in and save
              your session securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email or username</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button
              className="w-full"
              disabled={connectMutation.isPending || !email || !password}
              onClick={handleConnectCurrent}
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Connect & save session"
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={skipCurrent}>
              Skip this marketplace
            </Button>
            {currentIndex === selected.length - 1 &&
              connectStates[currentId] === "connected" && (
                <Button
                  className="w-full"
                  onClick={() => completeMutation.mutate()}
                >
                  Finish setup
                </Button>
              )}
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="font-medium">You&apos;re all set!</p>
            <p className="text-sm text-muted-foreground">
              Marketplace sessions will restore automatically on your next visit.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
