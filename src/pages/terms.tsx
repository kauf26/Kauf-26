import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TranslateWidget from "@/components/translate-widget";
import { DAILY_PRODUCT_CREATE_LIMIT } from "@shared/limits";

export default function Terms() {
  const lastUpdated = "April 8, 2026";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <ScrollText className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">Terms of Service & Legal Disclaimer</h1>
            </div>
            <TranslateWidget />
          </div>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">1. Eligibility and Age Requirement</h2>
              <p>
                By creating an account or using the Service, you represent and warrant that you are at least <strong className="text-foreground">13 years of age</strong>. The Service is not intended for use by anyone under 13. If you are between 13 and 18 years of age, you may only use the Service with the consent and supervision of a parent or legal guardian who agrees to these Terms on your behalf.
              </p>
              <p>
                By using the Service, you confirm that you have the legal capacity to enter into a binding agreement and that all information you provide is accurate.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">2. Service Description</h2>
              <p>
                Global Marketplace Lister ("the Service," "the App") is a software tool that assists users in drafting, organizing, and submitting product listings to third-party online marketplaces including but not limited to eBay, Amazon, Etsy, Shopify, Mercado Libre, Rakuten, and others (collectively, "Marketplaces"). The Service uses artificial intelligence provided by OpenAI to generate product titles and descriptions from uploaded images.
              </p>
              <p>
                The Service is a listing assistance tool only. It does not act as a marketplace, broker, agent, intermediary, or payment processor for any transaction between buyers and sellers. All sales, transactions, payments, and exchanges occur solely between the user and the respective Marketplace or end buyer, subject to each Marketplace's own terms of service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">3. AI-Generated Content</h2>
              <p>
                This Service uses artificial intelligence (AI) technology, specifically <strong className="text-foreground">OpenAI's GPT-4o model</strong>, to analyze product images and generate listing titles, descriptions, and price suggestions. By uploading an image, you consent to that image being transmitted to OpenAI's API for processing.
              </p>
              <p>
                AI-generated content is provided as a suggestion only and may be inaccurate, incomplete, or unsuitable for your specific product. You are solely responsible for reviewing, editing, and approving all AI-generated content before publishing any listing. The Service does not warrant the accuracy, completeness, or fitness for purpose of any AI-generated content.
              </p>
              <p>
                You must not use the Service to create listings for prohibited, counterfeit, illegal, or restricted items. You are solely responsible for ensuring your listings comply with all applicable laws, regulations, and Marketplace policies.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">4. No Guarantee of Sales or Marketplace Acceptance</h2>
              <p>
                The Service makes no representation or warranty, express or implied, that any product listing generated or submitted through the App will be approved, published, or remain active on any Marketplace. Each Marketplace independently determines what listings it accepts and may remove or reject listings at its sole discretion.
              </p>
              <p>
                The Service does not guarantee any sale, transaction, revenue, or profit. Actual results depend on market conditions, Marketplace policies, buyer demand, pricing, product condition, and numerous other factors entirely outside the control of the Service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">5. Service Fee Disclosure</h2>
              <p>
                The Service offers a <strong className="text-foreground">30-day free trial</strong> from the date of your first login. During the trial period, no service fees are charged. You may create up to {DAILY_PRODUCT_CREATE_LIMIT} new product listings per calendar day. After the trial period, the Service continues automatically with no action required from the user.
              </p>
              <p>
                <strong className="text-foreground">Per-Sale Fee (2%):</strong> Following the free trial, the Service charges a fee of <strong className="text-foreground">2% of each self-reported sale amount</strong> entered by the user. This fee applies only to transactions that the user records as sold — it does not apply to listings that are posted but do not result in a recorded sale. For example, if you have 500 items listed and one sells for $100, the service fee is $2.00. No fee is charged on the remaining 499 listings.
              </p>
              <p>
                <strong className="text-foreground">Monthly Volume Surcharge:</strong> In addition to the 2% per-sale fee, a flat monthly surcharge applies based on the number of sales recorded within a calendar month, as follows:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>0–25 sales/month: No surcharge</li>
                <li>26–50 sales/month: $4.99/month</li>
                <li>51–100 sales/month: $9.99/month</li>
                <li>101–250 sales/month: $19.99/month</li>
                <li>251–500 sales/month: $49.99/month</li>
                <li>More than 500 sales/month: Custom enterprise pricing — contact support</li>
              </ul>
              <p>
                The monthly surcharge resets on the first day of each calendar month. Surcharge tiers are determined by total self-reported sales within the current calendar month. The surcharge may be paid directly via Stripe or deducted from sale proceeds at the Service's discretion.
              </p>
              <p>
                <strong className="text-foreground">Important:</strong> All fees are based solely on the sale amounts and sale counts you self-report within the App. The Service is not a party to any transaction between you and any buyer or Marketplace. The Service has no right, claim, or interest in any actual transaction proceeds. These fees do not constitute a commission, lien, or interest in any funds you receive from any sale.
              </p>
              <p>
                <strong className="text-foreground">International Users:</strong> All fees are charged in US Dollars (USD) via Stripe. Users outside the United States are responsible for any applicable currency conversion fees, local taxes, VAT, GST, or other charges imposed by their jurisdiction. The Service does not collect, remit, or represent any local tax on your behalf. You are solely responsible for compliance with all tax obligations in your jurisdiction.
              </p>
              <p>
                You are solely responsible for accurately reporting sale amounts. The Service takes no responsibility for and makes no representations regarding the accuracy of user-entered data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">6. Currency Conversion Disclaimer</h2>
              <p>
                The Service provides estimated currency conversions for informational purposes only, using approximate exchange rates that may not reflect real-time or official market rates. You are responsible for verifying actual prices and exchange rates before publishing listings. The Service is not liable for any losses resulting from currency conversion inaccuracies.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">7. User Responsibilities</h2>
              <p>By using the Service, you agree that you are solely responsible for:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Complying with the terms of service of any Marketplace on which you list products</li>
                <li>Ensuring the accuracy of all product information, pricing, and availability</li>
                <li>Fulfilling all orders and transactions you enter into with buyers</li>
                <li>Paying all applicable taxes on sales proceeds you receive, including VAT, GST, or sales tax where required by your jurisdiction</li>
                <li>Obtaining all necessary rights and permissions to sell any listed items</li>
                <li>Complying with all applicable local, national, and international laws and regulations</li>
                <li>Ensuring that any product you list is accurately described, legally available for sale, and not counterfeit, prohibited, or infringing on any third-party rights</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">8. Acceptable Use</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>List, sell, or facilitate the sale of counterfeit, illegal, stolen, or prohibited goods</li>
                <li>Violate any applicable local, national, or international law or regulation</li>
                <li>Infringe upon the intellectual property rights of any third party</li>
                <li>Engage in fraud, misrepresentation, or deceptive trade practices</li>
                <li>Attempt to reverse-engineer, copy, or replicate the Service</li>
                <li>Transmit malware, spam, or any harmful content through the Service</li>
              </ul>
              <p>We reserve the right to suspend or terminate access to the Service for any user who violates these terms.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">9. Account Deletion</h2>
              <p>
                You may delete your account at any time from the Settings page within the app. Deleting your account permanently removes all associated data including your account record, products, listings, sales history, marketplace credentials, and dashboard preferences. This action is irreversible. You may also request account deletion by contacting us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">10. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by applicable law, the Service, its owners, operators, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages, including but not limited to lost profits, lost revenue, loss of data, or business interruption, arising out of or in connection with the use of the Service.
              </p>
              <p>
                The Service's total cumulative liability for any claim arising out of or related to these Terms or the Service shall not exceed the total fees paid by the user to the Service in the three (3) months immediately preceding the claim.
              </p>
              <p>
                The Service is not responsible or liable for the acts or omissions of any Marketplace, buyer, or third party involved in any transaction facilitated through a listing created using the Service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">11. Disclaimer of Warranties</h2>
              <p>
                The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. The Service does not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">12. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless the Service, its owners, operators, employees, and affiliates from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your use of the Service, your violation of these Terms, or your violation of any rights of a third party.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">13. Governing Law and Disputes</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located within the United States.
              </p>
              <p>
                For users in the European Union: nothing in these Terms limits your statutory rights under applicable EU consumer protection law, including any right to bring proceedings before the competent courts of your country of residence.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">14. Changes to Terms</h2>
              <p>
                The Service reserves the right to modify these Terms at any time. We will notify users of material changes by updating the "Last updated" date at the top of this page. Continued use of the Service after any modification constitutes acceptance of the updated Terms. You are encouraged to review these Terms periodically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">15. Contact</h2>
              <p>
                For questions about these Terms or the Service, please contact us at{" "}
                <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a>{" "}
                or visit{" "}
                <a href="https://kaufai.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">kaufai.com</a>.
              </p>
            </CardContent>
          </Card>

          <div className="pt-4 pb-8 text-xs text-muted-foreground border-t">
            <p>
              <strong>Note:</strong> These Terms of Service are provided for informational purposes. They do not constitute legal advice. If you have specific legal concerns about your business activities, consult a qualified attorney in your jurisdiction.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
