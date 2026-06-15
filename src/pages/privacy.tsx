import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TranslateWidget from "@/components/translate-widget";

export default function Privacy() {
  const lastUpdated = "April 4, 2026";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
            </div>
            <TranslateWidget />
          </div>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
              <p>Global Marketplace Lister collects the following information when you use the app:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Account information</strong> provided through Replit authentication, including your name, email address, and profile image</li>
                <li><strong className="text-foreground">Product photos</strong> you upload for AI analysis and listing generation</li>
                <li><strong className="text-foreground">Product details</strong> including titles, descriptions, prices, and quantities you enter</li>
                <li><strong className="text-foreground">Sale records</strong> you log within the app, including sale amounts and marketplace names</li>
                <li><strong className="text-foreground">Payment information</strong> processed securely through Stripe when paying service fees (we do not store card numbers — Stripe handles all payment data)</li>
                <li><strong className="text-foreground">App usage data</strong> such as your trial start date, subscription status, and dashboard preferences</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">2. Legal Basis for Processing (GDPR)</h2>
              <p>
                If you are located in the European Economic Area (EEA), we process your personal data under the following legal bases as defined in the EU General Data Protection Regulation (GDPR):
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Performance of a contract</strong> (Article 6(1)(b)) — processing your account data, product listings, and sales records is necessary to provide the Service you signed up for</li>
                <li><strong className="text-foreground">Legitimate interests</strong> (Article 6(1)(f)) — we process usage data to maintain, secure, and improve the Service, in ways that do not override your fundamental rights</li>
                <li><strong className="text-foreground">Compliance with legal obligations</strong> (Article 6(1)(c)) — where applicable law requires us to retain certain records</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
              <p>We use the information you provide to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Analyze product photos using AI to generate listing titles and descriptions</li>
                <li>Store and display your product listings and sales records within the app</li>
                <li>Calculate and process service fees based on sale amounts you enter</li>
                <li>Manage your free trial period and subscription status</li>
                <li>Operate, maintain, and improve the security and performance of the Service</li>
              </ul>
              <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">4. AI-Powered Image Processing</h2>
              <p>
                When you upload a product photo, it is transmitted to <strong className="text-foreground">OpenAI's API</strong> for analysis. OpenAI's systems process the image to identify the product and generate a title and description. This content is AI-generated and provided as a suggestion only — you are responsible for reviewing it before publishing any listing.
              </p>
              <p>
                Please review <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">OpenAI's Privacy Policy</a> for details on how they handle image data. We do not retain uploaded images on our servers beyond what is necessary for the Service to function, and images are automatically deleted after 90 days or sooner if your product sells.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">5. Payment Processing</h2>
              <p>
                All payments are processed through <strong className="text-foreground">Stripe</strong>, a PCI-DSS-compliant payment processor. We do not collect or store your credit card number, CVV, or billing address. Stripe's handling of your payment data is governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Stripe's Privacy Policy</a>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">6a. Marketplace OAuth Tokens (Mobile App)</h2>
              <p>
                When you connect marketplaces in the Kauf26 mobile app, OAuth access and refresh tokens are stored <strong className="text-foreground">only on your device</strong> (iOS Keychain or Android Keystore via Expo SecureStore). We do not persist marketplace OAuth tokens on our servers.
              </p>
              <p>
                When you publish a listing, tokens are sent to our server only for that single request to call the marketplace API on your behalf, then discarded. They are never logged or cached server-side.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">6. Data Storage and Security</h2>
              <p>
                Your data is stored in a secure PostgreSQL database. All data is transmitted over HTTPS (TLS encryption). We implement reasonable technical and organizational measures to protect your information from unauthorized access, loss, or misuse. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">7. Data Retention</h2>
              <p>
                We retain your account and listing data for as long as you maintain an account with us. Product images are automatically deleted within 90 days of upload, or immediately upon a product selling out if it was listed within the previous 30 days.
              </p>
              <p>
                You may delete your account at any time from the Settings page within the app. Account deletion permanently removes all of your data — including your account, products, listings, sales records, and credentials — from our systems within 24 hours. You may also contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a> to request deletion.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">8. Your Rights</h2>
              <p>Depending on your location, you may have the following rights regarding your personal data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Access</strong> — request a copy of the personal data we hold about you</li>
                <li><strong className="text-foreground">Correction</strong> — request that we correct inaccurate or incomplete data</li>
                <li><strong className="text-foreground">Deletion</strong> — request deletion of your personal data (the "right to be forgotten")</li>
                <li><strong className="text-foreground">Data portability</strong> — request that we provide your data in a structured, machine-readable format (GDPR)</li>
                <li><strong className="text-foreground">Restriction</strong> — request that we restrict our processing of your data in certain circumstances</li>
                <li><strong className="text-foreground">Objection</strong> — object to processing based on legitimate interests</li>
                <li><strong className="text-foreground">Withdrawal of consent</strong> — where we rely on consent, you may withdraw it at any time without affecting the lawfulness of prior processing</li>
              </ul>
              <p>To exercise any of these rights, please contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a>. We will respond within 30 days.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">9. International Users — GDPR, LGPD, and PIPEDA</h2>
              <p>
                <strong className="text-foreground">European Union / EEA (GDPR):</strong> If you are in the EU or EEA, you have rights under the General Data Protection Regulation (GDPR) as described in Section 8. You also have the right to lodge a complaint with your local data protection authority.
              </p>
              <p>
                <strong className="text-foreground">Brazil (LGPD):</strong> If you are in Brazil, you have rights under the Lei Geral de Proteção de Dados (LGPD), including the right to access, correct, delete, and port your personal data. Contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a> to exercise these rights.
              </p>
              <p>
                <strong className="text-foreground">Canada (PIPEDA):</strong> If you are in Canada, your personal data is handled in accordance with the Personal Information Protection and Electronic Documents Act (PIPEDA). You may request access to or correction of your information by contacting us directly.
              </p>
              <p>
                Your data may be processed and stored on servers located in the United States. By using the Service, you acknowledge this transfer and storage of your information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">10. Third-Party Services</h2>
              <p>The app integrates with the following third-party services, each of which has its own privacy policy:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">OpenAI</strong> — AI-powered product image analysis and description generation. Images you upload are transmitted to OpenAI. <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">OpenAI Privacy Policy</a></li>
                <li><strong className="text-foreground">Stripe</strong> — Secure payment processing for service fees. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Stripe Privacy Policy</a></li>
                <li><strong className="text-foreground">Replit</strong> — Authentication provider (sign-in with Google, Apple, GitHub, or email). <a href="https://replit.com/site/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Replit Privacy Policy</a></li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">11. Children's Privacy (COPPA)</h2>
              <p>
                This app is not directed to children under the age of 13, and we do not knowingly collect personal information from anyone under 13. Users must be at least 13 years of age to create an account or use the Service. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a> and we will delete that information promptly.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">12. Cookies and Local Storage</h2>
              <p>
                The app uses browser session cookies to keep you logged in and localStorage to remember your preferences (such as whether you have viewed the onboarding tutorial and your consent to this Privacy Policy). We do not use advertising cookies or tracking pixels. No third-party advertising networks have access to your data through this app.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">13. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify users of significant changes by updating the "Last updated" date at the top of this page. Continued use of the app after changes constitutes acceptance of the updated policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">14. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, wish to exercise your data rights, or have a privacy concern, please contact us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a> or visit <a href="https://kauf26.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">kauf26.com</a>.
              </p>
            </CardContent>
          </Card>

          <div className="pt-4 pb-8 text-xs text-muted-foreground border-t">
            <p>This Privacy Policy applies to the Global Marketplace Lister web application and any associated mobile apps available on the Apple App Store or Google Play.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
