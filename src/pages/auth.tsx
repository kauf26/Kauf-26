import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";

interface AuthStatus {
  hasUser: boolean;
  hasPinSet: boolean;
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [isSetupMode, setIsSetupMode] = useState(false);

  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) throw new Error("Failed to check auth");
      return res.json();
    },
  });

  useEffect(() => {
    if (authStatus) {
      setIsSetupMode(!authStatus.hasPinSet);
    }
  }, [authStatus]);

  const loginMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      sessionStorage.setItem("authenticated", "true");
      toast({ title: "Welcome back!", description: "You're now logged in." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
      setPin(["", "", "", ""]);
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Setup failed");
      }
      return res.json();
    },
    onSuccess: () => {
      sessionStorage.setItem("authenticated", "true");
      toast({ title: "PIN Created!", description: "Your 4-digit PIN is now set." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePinChange = (index: number, value: string, isConfirm = false) => {
    if (!/^\d?$/.test(value)) return;

    const target = isConfirm ? [...confirmPin] : [...pin];
    target[index] = value;

    if (isConfirm) {
      setConfirmPin(target);
    } else {
      setPin(target);
    }

    if (value && index < 3) {
      const nextInput = document.getElementById(
        isConfirm ? `confirm-pin-${index + 1}` : `pin-${index + 1}`
      );
      nextInput?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    isConfirm = false
  ) => {
    if (e.key === "Backspace" && index > 0) {
      const target = isConfirm ? confirmPin : pin;
      if (!target[index]) {
        const prevInput = document.getElementById(
          isConfirm ? `confirm-pin-${index - 1}` : `pin-${index - 1}`
        );
        prevInput?.focus();
      }
    }
  };

  const handleSubmit = () => {
    const pinCode = pin.join("");
    if (pinCode.length !== 4) {
      toast({
        title: "Invalid PIN",
        description: "Please enter all 4 digits",
        variant: "destructive",
      });
      return;
    }

    if (isSetupMode) {
      const confirmCode = confirmPin.join("");
      if (pinCode !== confirmCode) {
        toast({
          title: "PINs Don't Match",
          description: "Please make sure both PINs are the same",
          variant: "destructive",
        });
        return;
      }
      setupMutation.mutate(pinCode);
    } else {
      loginMutation.mutate(pinCode);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-auth">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {isSetupMode ? (
              <ShieldCheck className="w-8 h-8 text-primary" />
            ) : (
              <Lock className="w-8 h-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isSetupMode ? "Create Your PIN" : "Enter Your PIN"}
          </CardTitle>
          <CardDescription>
            {isSetupMode
              ? "Set up a 4-digit PIN to secure your listings"
              : "Enter your 4-digit PIN to access your dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-center block mb-3">
              {isSetupMode ? "Choose a PIN" : "Your PIN"}
            </Label>
            <div className="flex justify-center gap-3">
              {pin.map((digit, index) => (
                <Input
                  key={index}
                  id={`pin-${index}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="w-14 h-14 text-center text-2xl font-bold"
                  data-testid={`input-pin-${index}`}
                />
              ))}
            </div>
          </div>

          {isSetupMode && (
            <div>
              <Label className="text-center block mb-3">Confirm PIN</Label>
              <div className="flex justify-center gap-3">
                {confirmPin.map((digit, index) => (
                  <Input
                    key={index}
                    id={`confirm-pin-${index}`}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value, true)}
                    onKeyDown={(e) => handleKeyDown(e, index, true)}
                    className="w-14 h-14 text-center text-2xl font-bold"
                    data-testid={`input-confirm-pin-${index}`}
                  />
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loginMutation.isPending || setupMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="button-submit-pin"
          >
            {loginMutation.isPending || setupMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {isSetupMode ? "Setting up..." : "Verifying..."}
              </>
            ) : isSetupMode ? (
              "Create PIN"
            ) : (
              "Unlock"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
