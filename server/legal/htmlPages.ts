const LAST_UPDATED = "July 4, 2026";
const PRIVACY_URL = "https://kauf-26.onrender.com/api/privacy";
const TERMS_URL = "https://kauf-26.onrender.com/api/terms";
const CONTACT_EMAIL = "kaufit@yahoo.com";

function legalPageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} — Kauf26</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:48rem;margin:0 auto;padding:2rem 1.25rem;background:#fafafa}
    h1{font-size:1.75rem;margin-bottom:.25rem}
    h2{font-size:1.125rem;margin-top:1.75rem;color:#111827}
    p,li{font-size:.9375rem;color:#374151}
    ul{padding-left:1.25rem}
    .meta{color:#6b7280;font-size:.875rem;margin-bottom:1.5rem}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:.75rem;padding:1.25rem;margin:1rem 0}
    a{color:#2563eb}
    footer{margin-top:2rem;font-size:.8125rem;color:#6b7280}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Last updated: ${LAST_UPDATED}</p>
  ${body}
  <footer>
    <p>Kauf26 (Global Marketplace Lister) · <a href="${PRIVACY_URL}">Privacy Policy</a> · <a href="${TERMS_URL}">Terms of Service</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  </footer>
</body>
</html>`;
}

export function renderPrivacyPolicyHtml(): string {
  const body = `
  <div class="card">
    <h2>1. Information We Collect</h2>
    <p>Kauf26 collects the following when you use the app:</p>
    <ul>
      <li><strong>Email address and name</strong> — from Sign in with Apple, Google, or account registration</li>
      <li><strong>Product photos</strong> — images you capture or select for AI identification and listing drafts</li>
      <li><strong>User ID</strong> — internal account identifier for authentication and sync</li>
      <li><strong>Product interaction data</strong> — trial status, listing drafts, and feature usage</li>
      <li><strong>Marketplace OAuth tokens</strong> — stored only on your device (iOS Keychain); not persisted on our servers</li>
    </ul>
    <p>We do not sell your personal information. We do not use your data for cross-app tracking.</p>
  </div>
  <div class="card">
    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>Authenticate your account and sync drafts across devices</li>
      <li>Transmit product photos to OpenAI for AI-powered title and description generation</li>
      <li>Publish listings to marketplaces you connect (eBay, Etsy, Shopify, etc.) at your direction</li>
      <li>Process service fees through Stripe when applicable</li>
      <li>Operate, secure, and improve the Service</li>
    </ul>
  </div>
  <div class="card">
    <h2>3. Third-Party Services</h2>
    <ul>
      <li><strong>OpenAI</strong> — product image analysis and AI-generated listing text. <a href="https://openai.com/policies/privacy-policy">OpenAI Privacy Policy</a></li>
      <li><strong>Apple</strong> — Sign in with Apple authentication. <a href="https://www.apple.com/legal/privacy/">Apple Privacy Policy</a></li>
      <li><strong>Google</strong> — Google Sign-In authentication (optional). <a href="https://policies.google.com/privacy">Google Privacy Policy</a></li>
      <li><strong>Stripe</strong> — payment processing; we do not store card numbers. <a href="https://stripe.com/privacy">Stripe Privacy Policy</a></li>
      <li><strong>Marketplaces</strong> — eBay, Etsy, Shopify, and others when you connect accounts and publish listings</li>
    </ul>
  </div>
  <div class="card">
    <h2>4. GDPR (European Economic Area)</h2>
    <p>If you are in the EEA, we process personal data under:</p>
    <ul>
      <li><strong>Contract (Art. 6(1)(b))</strong> — providing the Service you signed up for</li>
      <li><strong>Legitimate interests (Art. 6(1)(f))</strong> — security and Service improvement</li>
      <li><strong>Legal obligation (Art. 6(1)(c))</strong> — where applicable law requires retention</li>
    </ul>
    <p>You have rights to access, rectify, erase, restrict, port, and object to processing. Contact <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> to exercise these rights.</p>
  </div>
  <div class="card">
    <h2>5. CCPA / CPRA (California)</h2>
    <p>California residents may request: (1) categories of personal information collected; (2) deletion of personal information; (3) correction of inaccurate information. We do not sell personal information. We do not share personal information for cross-context behavioral advertising.</p>
    <p>Submit requests to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We will respond within 45 days as required by law.</p>
  </div>
  <div class="card">
    <h2>6. Data Retention &amp; Security</h2>
    <p>Product images are retained only as long as needed for the Service and deleted within 90 days of sale or account deletion unless law requires longer retention. We use HTTPS encryption in transit and industry-standard security practices.</p>
  </div>
  <div class="card">
    <h2>7. Children's Privacy</h2>
    <p>Kauf26 is not directed to children under 13. We do not knowingly collect data from children under 13. Contact us to request deletion if you believe a child provided personal information.</p>
  </div>
  <div class="card">
    <h2>8. Contact</h2>
    <p>Questions: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  </div>`;
  return legalPageShell("Privacy Policy", body);
}

export function renderTermsOfServiceHtml(): string {
  const body = `
  <div class="card">
    <h2>1. Agreement</h2>
    <p>By using Kauf26 ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service. You must be at least 13 years old (18+ or parental consent if under 18).</p>
  </div>
  <div class="card">
    <h2>2. Service Description</h2>
    <p>Kauf26 is an AI-powered listing assistant for third-party marketplaces (eBay, Etsy, Shopify, Amazon, and others). The Service helps you identify products from photos, generate listing drafts, and publish to connected marketplaces.</p>
    <p>Kauf26 is <strong>not</strong> a marketplace, broker, or payment processor. All sales occur on third-party platforms under their terms.</p>
  </div>
  <div class="card">
    <h2>3. AI-Generated Content Disclaimer</h2>
    <p>The Service uses <strong>OpenAI GPT-4o</strong> to analyze images and generate titles, descriptions, and price suggestions. By uploading images, you consent to transmission to OpenAI's API.</p>
    <p>AI output is a <strong>suggestion only</strong>. You are solely responsible for reviewing accuracy, legality, and marketplace compliance before publishing. Kauf26 does not warrant AI-generated content.</p>
  </div>
  <div class="card">
    <h2>4. Marketplace Integrations</h2>
    <ul>
      <li>You must comply with each marketplace's terms of service and policies</li>
      <li>OAuth tokens are stored on your device; you authorize Kauf26 to use them only when you publish</li>
      <li>We do not guarantee listing approval, visibility, or sales on any marketplace</li>
      <li>You are responsible for prohibited/restricted items and accurate product descriptions</li>
    </ul>
  </div>
  <div class="card">
    <h2>5. Account &amp; Authentication</h2>
    <p>You may sign in with Apple or Google. You are responsible for maintaining account security. You may delete your account in Settings; deletion removes server-side account data.</p>
  </div>
  <div class="card">
    <h2>6. Fees &amp; Trial</h2>
    <p>A free trial period may apply from first login. After the trial, service fees may apply as disclosed in-app. Payments are processed by Stripe. Refund policies follow applicable law and in-app disclosures.</p>
  </div>
  <div class="card">
    <h2>7. Limitation of Liability</h2>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, KAUF26 IS PROVIDED "AS IS" WITHOUT WARRANTIES. WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, LOST PROFITS, OR MARKETPLACE REJECTION OF LISTINGS.</p>
  </div>
  <div class="card">
    <h2>8. Governing Law</h2>
    <p>These Terms are governed by applicable law in your jurisdiction unless otherwise required. Disputes should first be directed to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
  </div>
  <div class="card">
    <h2>9. Changes</h2>
    <p>We may update these Terms. Continued use after changes constitutes acceptance. Material changes will be reflected in the "Last updated" date above.</p>
  </div>`;
  return legalPageShell("Terms of Service", body);
}
