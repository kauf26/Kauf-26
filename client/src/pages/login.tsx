import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Fingerprint } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border shadow-lg">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-3xl font-bold tracking-tight">
            Kauf26
          </CardTitle>
          <CardDescription>
            Sign in on the web with your PIN. Face ID and Touch ID are available
            in the mobile app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            className="w-full gap-2 h-12 text-base"
            onClick={() => setLocation("/auth")}
          >
            <Fingerprint className="h-5 w-5" />
            Continue with PIN
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
