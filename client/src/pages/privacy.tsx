import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Privacy() {
  const lastUpdated = "April 3, 2026";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
              <p>Global Marketplace Lister collects the following information when you use the app:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Product photos</strong> you upload for AI analysis and listing generation</li>
                <li><strong className="text-foreground">Product details</strong> including titles, descriptions, prices, and quantities you enter</li>
                <li><strong className="text-foreground">Sale records</strong> you log within the app, including sale amounts and marketplace names</li>
                <li><strong className="text-foreground">Payment information</strong> processed securely through Stripe when paying service fees or subscriptions (we do not store card numbers — Stripe handles all payment data)</li>
                <li><strong className="text-foreground">App usage data</strong> such as trial start date and subscription status</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
              <p>We use the information you provide to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Analyze product photos using AI to generate listing titles and descriptions</li>
                <li>Store and display your product listings and sales records within the app</li>
                <li>Calculate and process service fees based on sale amounts you enter</li>
                <li>Manage your free trial period and subscription status</li>
                <li>Improve the accuracy and quality of AI-generated content</li>
              </ul>
              <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">3. Product Photos and AI Processing</h2>
              <p>
                When you upload a product photo, it is sent to OpenAI's API for analysis. OpenAI processes the image to identify the product and generate a description. Please review <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">OpenAI's Privacy Policy</a> for details on how they handle image data. We do not retain uploaded images beyond what is necessary to generate your listing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">4. Payment Processing</h2>
              <p>
                All payments are processed through Stripe, a PCI-compliant payment processor. We do not collect or store your credit card number, CVV, or billing information. Stripe's handling of your payment data is governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Stripe's Privacy Policy</a>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">5. Data Storage and Security</h2>
              <p>
                Your data is stored in a secure PostgreSQL database. We implement reasonable technical and organizational measures to protect your information from unauthorized access, loss, or misuse. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
              <p>
                We retain your data for as long as you use the app. If you wish to have your data deleted, you may also use the in-app account deletion feature in Settings, or contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a> and we will remove your records within 30 days.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">7. Third-Party Services</h2>
              <p>The app integrates with the following third-party services:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">OpenAI</strong> — AI-powered product analysis and description generation</li>
                <li><strong className="text-foreground">Stripe</strong> — Secure payment processing</li>
              </ul>
              <p>Each of these services has its own privacy policy governing how they handle data transmitted to them.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">8. Children's Privacy</h2>
              <p>
                This app is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">9. Your Rights</h2>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict our processing of your data</li>
              </ul>
              <p>To exercise any of these rights, please contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a>.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify users of significant changes by updating the "Last updated" date at the top of this page. Continued use of the app after changes constitutes acceptance of the updated policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or how we handle your data, please contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a> or visit <a href="https://kauf26.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">kauf26.com</a>.
              </p>
            </CardContent>
          </Card>

          <div className="pt-4 pb-8 text-xs text-muted-foreground border-t">
            <p>This Privacy Policy applies to the Global Marketplace Lister web application and any associated mobile apps.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
