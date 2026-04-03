import { useState } from "react";
import { Store, Apple, Smartphone, Copy, Check, ExternalLink, CircleDot, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Button variant="ghost" size="sm" onClick={copy} className="h-6 px-2 text-xs gap-1">
          {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </Button>
      </div>
      <div className="bg-muted/40 rounded-md px-3 py-2 text-sm font-mono whitespace-pre-wrap border">{text}</div>
    </div>
  );
}

function Step({ num, title, done, children }: { num: number; title: string; done?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"}`}>
          {done ? <Check className="w-4 h-4" /> : num}
        </div>
        <span className="font-medium flex-1">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4 border-t bg-muted/10">{children}</div>}
    </div>
  );
}

const shortDesc = `AI-powered product listing tool for eBay, Amazon, Etsy, Shopify, Mercado Libre, Rakuten, and more. Snap a photo, get an AI-generated title and description, and publish to multiple marketplaces at once — with automatic currency conversion and translation.`;

const longDesc = `Global Marketplace Lister makes selling online simple. Take a photo of any product, and our AI instantly generates a professional title and description. Then publish your listing to multiple e-commerce marketplaces with a single tap — including eBay, Amazon, Etsy, Shopify, Walmart, Wish, Reverb, AliExpress, Mercado Libre, Rakuten, and more.

KEY FEATURES
• AI-powered listing creation from a single product photo
• Publish to 13+ marketplaces simultaneously
• Automatic currency conversion (USD, EUR, GBP, JPY, MXN, and more)
• Built-in translation for international marketplaces
• Sales tracking with fee management
• 30-day free trial — no credit card required
• Simple 1% service fee per sale after your 30-day free trial

WHO IT'S FOR
Perfect for resellers, small business owners, estate sale shoppers, thrift flippers, collectibles dealers, and anyone who sells on multiple platforms.

MARKETPLACES SUPPORTED
eBay, Amazon, Etsy, Shopify, WooCommerce, Walmart, Wish, Reverb, AliExpress, BigCommerce, Mercado Libre, Rakuten, PrestaShop

Start your free trial today and simplify your selling workflow.`;

const keywords = `product listing,eBay,Amazon,Etsy,reseller,marketplace,sell online,multi-platform,AI listing,Shopify,price converter,translation,cross-listing`;

export default function Submit() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">App Store Submission Guide</h1>
          </div>
          <p className="text-muted-foreground text-lg">Everything you need to submit to Apple and Google — copy and paste ready.</p>
        </div>

        {/* Store Listing Copy */}
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">Store Listing Copy</h2>
          <p className="text-sm text-muted-foreground">Use these for both the Apple App Store and Google Play Store.</p>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <CopyBlock label="App Name (30 chars max)" text="Global Marketplace Lister" />
              <CopyBlock label="Subtitle / Short Description" text={shortDesc} />
              <CopyBlock label="Full Description" text={longDesc} />
              <CopyBlock label="Keywords (Apple — 100 chars max)" text={keywords} />
            </CardContent>
          </Card>
        </div>

        {/* Store Info */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="w-5 h-5" /> Apple App Store
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between"><span>Developer fee</span><Badge variant="secondary">$99 / year</Badge></div>
              <div className="flex justify-between"><span>Review time</span><Badge variant="secondary">1–3 days</Badge></div>
              <div className="flex justify-between"><span>Category</span><Badge variant="secondary">Business</Badge></div>
              <div className="flex justify-between"><span>Age rating</span><Badge variant="secondary">4+</Badge></div>
              <div className="flex justify-between"><span>Content rights</span><Badge variant="secondary">Does not use third-party content</Badge></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="w-5 h-5" /> Google Play Store
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between"><span>Developer fee</span><Badge variant="secondary">$25 one-time</Badge></div>
              <div className="flex justify-between"><span>Review time</span><Badge variant="secondary">1–3 days</Badge></div>
              <div className="flex justify-between"><span>Category</span><Badge variant="secondary">Business</Badge></div>
              <div className="flex justify-between"><span>Content rating</span><Badge variant="secondary">Everyone</Badge></div>
              <div className="flex justify-between"><span>Target audience</span><Badge variant="secondary">Adults 18+</Badge></div>
            </CardContent>
          </Card>
        </div>

        {/* Apple Steps */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Apple className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Apple App Store — Step by Step</h2>
          </div>

          <Step num={1} title="Create an Apple Developer account">
            <p className="text-sm text-muted-foreground">Go to <a href="https://developer.apple.com/programs/" target="_blank" rel="noopener noreferrer" className="underline text-primary">developer.apple.com/programs</a> and enroll. Costs $99/year. You'll need an Apple ID and a few minutes to verify your identity.</p>
          </Step>

          <Step num={2} title="Publish this app and get your live URL">
            <p className="text-sm text-muted-foreground">Use the Publish button in Replit to get your live <code className="bg-muted px-1 rounded">.replit.app</code> URL. You need this before the next step.</p>
          </Step>

          <Step num={3} title="Use PWABuilder to generate the iOS package">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Go to <a href="https://pwabuilder.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">pwabuilder.com <ExternalLink className="w-3 h-3 inline" /></a></p>
              <p>2. Paste your live app URL and click Start</p>
              <p>3. Click <strong className="text-foreground">Package for stores</strong> → select <strong className="text-foreground">iOS</strong></p>
              <p>4. Download the generated Xcode project</p>
            </div>
          </Step>

          <Step num={4} title="Build and sign with Xcode (requires a Mac)">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Open the downloaded project in Xcode. Sign it with your Apple Developer account under <strong className="text-foreground">Signing & Capabilities</strong>. If you don't have a Mac, use <a href="https://codemagic.io" target="_blank" rel="noopener noreferrer" className="underline text-primary">Codemagic.io</a> to build remotely.</p>
            </div>
          </Step>

          <Step num={5} title="Submit through App Store Connect">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Go to <a href="https://appstoreconnect.apple.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">appstoreconnect.apple.com <ExternalLink className="w-3 h-3 inline" /></a></p>
              <p>2. Create a new app → paste the listing copy above</p>
              <p>3. Upload screenshots (at least one iPhone screenshot required)</p>
              <p>4. Add your Privacy Policy URL: your live app URL + <code className="bg-muted px-1 rounded">/privacy</code></p>
              <p>5. Upload the <code className="bg-muted px-1 rounded">.ipa</code> file from Xcode and submit for review</p>
            </div>
          </Step>
        </div>

        {/* Google Steps */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Google Play Store — Step by Step</h2>
          </div>

          <Step num={1} title="Create a Google Play Developer account">
            <p className="text-sm text-muted-foreground">Go to <a href="https://play.google.com/console" target="_blank" rel="noopener noreferrer" className="underline text-primary">play.google.com/console <ExternalLink className="w-3 h-3 inline" /></a>. One-time $25 fee. Takes about 24 hours to activate.</p>
          </Step>

          <Step num={2} title="Use PWABuilder to generate the Android package">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Go to <a href="https://pwabuilder.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">pwabuilder.com <ExternalLink className="w-3 h-3 inline" /></a> with your live URL</p>
              <p>2. Click <strong className="text-foreground">Package for stores</strong> → select <strong className="text-foreground">Android</strong></p>
              <p>3. Download the <code className="bg-muted px-1 rounded">.aab</code> file (Android App Bundle)</p>
            </div>
          </Step>

          <Step num={3} title="Create a new app in Play Console">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. In the Play Console, click <strong className="text-foreground">Create app</strong></p>
              <p>2. Fill in the name, select <strong className="text-foreground">App</strong> and <strong className="text-foreground">Free</strong></p>
              <p>3. Paste the listing copy from above into the store listing fields</p>
              <p>4. Add your Privacy Policy URL: your live URL + <code className="bg-muted px-1 rounded">/privacy</code></p>
            </div>
          </Step>

          <Step num={4} title="Upload your app and screenshots">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Upload the <code className="bg-muted px-1 rounded">.aab</code> file under <strong className="text-foreground">Production → Releases</strong>. Add at least 2 phone screenshots. You can take them directly from your browser using Chrome DevTools mobile view.</p>
            </div>
          </Step>

          <Step num={5} title="Complete the content rating and submit">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Complete the content rating questionnaire (answer No to all sensitive content questions). Set pricing to <strong className="text-foreground">Free</strong>. Click <strong className="text-foreground">Submit for review</strong>. Approval usually takes 1–3 days.</p>
            </div>
          </Step>
        </div>

        {/* Required assets */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CircleDot className="w-4 h-4 text-orange-400" />
              Required Before You Submit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2"><span className="text-green-400 font-bold mt-0.5">✓</span><span><strong className="text-foreground">App icon</strong> — Already in the app (K logo)</span></div>
            <div className="flex items-start gap-2"><span className="text-green-400 font-bold mt-0.5">✓</span><span><strong className="text-foreground">Privacy Policy</strong> — Live at your URL + <code className="bg-muted px-1 rounded">/privacy</code></span></div>
            <div className="flex items-start gap-2"><span className="text-green-400 font-bold mt-0.5">✓</span><span><strong className="text-foreground">Terms of Service</strong> — Live at your URL + <code className="bg-muted px-1 rounded">/terms</code></span></div>
            <div className="flex items-start gap-2"><span className="text-orange-400 font-bold mt-0.5">!</span><span><strong className="text-foreground">Screenshots</strong> — Need at least 3 phone-sized screenshots. Take them in Chrome: open the app, press F12, toggle device toolbar, screenshot.</span></div>
            <div className="flex items-start gap-2"><span className="text-orange-400 font-bold mt-0.5">!</span><span><strong className="text-foreground">Developer accounts</strong> — Apple ($99/yr) and/or Google Play ($25 one-time)</span></div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
