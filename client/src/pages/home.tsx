import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/products/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to analyze image");
      return res.json();
    },
    onSuccess: (data) => {
      sessionStorage.setItem("pendingAnalysis", JSON.stringify(data));
      setLocation("/create");
    },
    onError: () => {
      setPreviewing(false);
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewing(true);
      analyzeMutation.mutate(file);
    }
  };

  const isLoading = analyzeMutation.isPending;

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center bg-background px-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-image"
      />

      <button
        data-testid="button-take-photo"
        onClick={() => !isLoading && inputRef.current?.click()}
        disabled={isLoading}
        className="group flex flex-col items-center gap-8 focus:outline-none"
      >
        <div className={`w-44 h-44 rounded-full border-4 flex items-center justify-center transition-all duration-200
          ${isLoading
            ? "border-primary bg-primary/10"
            : "border-primary/40 bg-primary/5 group-hover:border-primary group-hover:bg-primary/10 group-active:scale-95"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-20 h-20 text-primary animate-spin" />
          ) : (
            <Camera className="w-20 h-20 text-primary transition-transform duration-200 group-hover:scale-110" />
          )}
        </div>

        <div className="text-center space-y-2">
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {isLoading ? "Analyzing your product…" : "Take a photo of the product you want to sell"}
          </p>
          {!isLoading && (
            <p className="text-muted-foreground text-base">
              Tap to open your camera or choose a photo
            </p>
          )}
        </div>
      </button>
    </div>
  );
}
