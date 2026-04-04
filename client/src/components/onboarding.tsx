import { useState, useEffect } from "react";
import { Camera, Globe, DollarSign, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "global_lister_onboarded";

const SLIDES = [
  {
    icon: Camera,
    iconBg: "bg-blue-600",
    gradientFrom: "from-blue-600/20",
    gradientTo: "to-blue-900/5",
    accentColor: "text-blue-400",
    step: "Step 1",
    title: "Snap a Picture",
    description:
      "Point your camera at any product you want to sell. Our AI instantly recognizes what it is and writes the perfect listing — title, description, and suggested price.",
    detail: "Works with any product, new or used.",
  },
  {
    icon: Globe,
    iconBg: "bg-purple-600",
    gradientFrom: "from-purple-600/20",
    gradientTo: "to-purple-900/5",
    accentColor: "text-purple-400",
    step: "Step 2",
    title: "Share on 14+ Marketplaces",
    description:
      "One tap publishes your listing to eBay, Amazon, Etsy, Shopify, Walmart, OfferUp, Mercado Libre, and more — with automatic translation and currency conversion for every country.",
    detail: "Reach buyers worldwide in seconds.",
  },
  {
    icon: DollarSign,
    iconBg: "bg-green-600",
    gradientFrom: "from-green-600/20",
    gradientTo: "to-green-900/5",
    accentColor: "text-green-400",
    step: "Step 3",
    title: "Sell Your Products",
    description:
      "Track every sale across all marketplaces in one place. Log what sold, where, and for how much. Your first 30 days are completely free — then just 1% per sale.",
    detail: "No monthly subscription. Pay only when you sell.",
  },
];

export function useOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  return { show, dismiss };
}

export default function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  const [slide, setSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];
  const Icon = current.icon;

  const goNext = () => {
    if (animating) return;
    if (isLast) {
      onDismiss();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setSlide((s) => s + 1);
      setAnimating(false);
    }, 200);
  };

  const goTo = (i: number) => {
    if (i === slide || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setSlide(i);
      setAnimating(false);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4 pt-safe">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-muted-foreground gap-1.5"
          data-testid="button-onboarding-skip"
        >
          <X className="w-4 h-4" />
          Skip
        </Button>
      </div>

      {/* Slide content */}
      <div
        className={`flex-1 flex flex-col items-center justify-center px-8 transition-opacity duration-200 ${
          animating ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Icon illustration */}
        <div className={`relative mb-10`}>
          <div
            className={`w-40 h-40 rounded-full bg-gradient-to-br ${current.gradientFrom} ${current.gradientTo} flex items-center justify-center`}
          >
            <div className={`w-24 h-24 rounded-full ${current.iconBg} flex items-center justify-center shadow-2xl`}>
              <Icon className="w-12 h-12 text-white" />
            </div>
          </div>
          {/* Step badge */}
          <div className={`absolute -top-2 -right-2 ${current.iconBg} text-white text-xs font-bold px-3 py-1 rounded-full`}>
            {current.step}
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {current.title}
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            {current.description}
          </p>
          <p className={`text-sm font-medium ${current.accentColor}`}>
            {current.detail}
          </p>
        </div>

        {/* Marketplace logos for slide 2 */}
        {slide === 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-xs">
            {["eBay", "Amazon", "Etsy", "Shopify", "Walmart", "OfferUp", "Mercado Libre", "Reverb", "+ 6 more"].map((m) => (
              <span
                key={m}
                className="text-xs bg-white/5 border border-white/10 text-muted-foreground px-3 py-1 rounded-full"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {/* Trial callout for slide 3 */}
        {slide === 2 && (
          <div className="mt-8 bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4 text-center max-w-xs">
            <p className="text-green-400 font-semibold text-sm">30-Day Free Trial</p>
            <p className="text-muted-foreground text-xs mt-1">
              No credit card required. After trial, pay 1% only when you make a sale.
            </p>
          </div>
        )}
      </div>

      {/* Bottom — dots + button */}
      <div className="px-8 pb-10 pb-safe space-y-6">
        {/* Dot indicators */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              data-testid={`button-onboarding-dot-${i}`}
              className={`rounded-full transition-all duration-300 ${
                i === slide
                  ? "w-8 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        {/* CTA button */}
        <Button
          size="lg"
          className="w-full text-base font-semibold gap-2 h-14"
          onClick={goNext}
          data-testid={isLast ? "button-onboarding-getstarted" : "button-onboarding-next"}
        >
          {isLast ? (
            <>
              <Camera className="w-5 h-5" />
              Take Your First Photo
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
