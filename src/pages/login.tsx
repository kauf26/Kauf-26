import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Loader2 } from "lucide-react";

const PIN_LENGTH = 4;

interface AuthStatus {
  hasUser: boolean;
  hasPinSet: boolean;
}

function verifyPinWithServer(pin: string): Promise<unknown> {
  return fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    return res.json();
  });
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [digits, setDigits] = useState<string[]>(() => Array(PIN_LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { data: authStatus, isLoading: authLoading } = useQuery<AuthStatus>({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) throw new Error("Failed to check auth");
      return res.json();
    },
  });

  useEffect(() => {
    if (authStatus && !authStatus.hasPinSet) {
      setLocation("/auth");
    }
  }, [authStatus, setLocation]);

  const loginMutation = useMutation({
    mutationFn: verifyPinWithServer,
    onSuccess: () => {
      sessionStorage.setItem("authenticated", "true");
      toast({ title: "Welcome back!", description: "You're now logged in." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Incorrect PIN",
        description: error.message,
        variant: "destructive",
      });
      setDigits(Array(PIN_LENGTH).fill(""));
      requestAnimationFrame(() => inputRefs.current[0]?.focus());
    },
  });

  const verifyPin = (pin: string) => {
    if (pin.length !== PIN_LENGTH) return;
    loginMutation.mutate(pin);
  };

  const applyPastedPin = (pasted: string) => {
    const chars = pasted.split("");
    while (chars.length < PIN_LENGTH) chars.push("");
    const next = chars.slice(0, PIN_LENGTH);
    setDigits(next);
    requestAnimationFrame(() => {
      inputRefs.current[PIN_LENGTH - 1]?.focus();
      verifyPin(pasted.slice(0, PIN_LENGTH));
    });
  };

  const handleChange = (index: number, raw: string) => {
    if (loginMutation.isPending) return;
    const last = raw.replace(/\D/g, "").slice(-1);
    if (raw !== "" && last === "") return;

    const next = [...digits];
    next[index] = last;
    setDigits(next);

    if (last && index < PIN_LENGTH - 1) {
      requestAnimationFrame(() => inputRefs.current[index + 1]?.focus());
    } else if (last && index === PIN_LENGTH - 1) {
      const pin = next.join("");
      if (pin.length === PIN_LENGTH) verifyPin(pin);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (digits[index]) return;
      if (index > 0) {
        e.preventDefault();
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (loginMutation.isPending) return;
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (pasted.length < PIN_LENGTH) return;
    e.preventDefault();
    applyPastedPin(pasted);
  };

  useEffect(() => {
    if (!authLoading && authStatus?.hasPinSet) {
      inputRefs.current[0]?.focus();
    }
  }, [authLoading, authStatus?.hasPinSet]);

  if (authLoading || (authStatus && !authStatus.hasPinSet)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border shadow-lg overflow-hidden">
        <CardHeader className="text-center space-y-1 pb-2">
          <CardTitle className="text-3xl font-bold tracking-tight">Kauf26</CardTitle>
          <CardDescription>
            Sign in on the web with your PIN. Face ID and Touch ID are available in the mobile
            app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pb-8">
          <Card className="border bg-muted/40 shadow-sm">
            <CardHeader className="pb-3 pt-5 px-5 space-y-0">
              <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground">
                PIN
              </CardTitle>
              <CardDescription className="text-xs pt-1">
                Enter your 4-digit code — focus moves automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-6 pt-0">
              <div className="flex justify-center gap-2 sm:gap-3">
                {digits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    disabled={loginMutation.isPending}
                    aria-label={`Digit ${index + 1} of ${PIN_LENGTH}`}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="h-14 w-12 sm:w-14 rounded-lg border-2 text-center text-2xl font-semibold tracking-tight tabular-nums shadow-none transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                ))}
              </div>
              {loginMutation.isPending && (
                <div className="flex justify-center mt-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full gap-2 h-11 text-sm text-muted-foreground"
            onClick={() => setLocation("/auth")}
          >
            <Fingerprint className="h-4 w-4" />
            PIN help and account options
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
