import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Terms() {
  const lastUpdated = "April 3, 2026";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ScrollText className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Terms of Service & Legal Disclaimer</h1>
          </div>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">1. Service Description</h2>
              <p>
                Global Marketplace Lister ("the Service," "the App") is a software tool that assists users in drafting, organizing, and submitting product listings to third-party online marketplaces including but not limited to eBay, Amazon, Etsy, Shopify, Mercado Libre, Rakuten, and others (collectively, "Marketplaces"). The Service uses artificial intelligence to generate product titles and descriptions from uploaded images.
              </p>
              <p>
                The Service is a listing assistance tool only. It does not act as a marketplace, broker, agent, intermediary, or payment processor for any transaction between buyers and sellers. All sales, transactions, payments, and exchanges occur solely between the user and the respective Marketplace or end buyer, subject to each Marketplace's own terms of service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">2. No Guarantee of Sales or Marketplace Acceptance</h2>
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
              <h2 className="text-lg font-semibold text-foreground">3. Service Fee Disclosure</h2>
              <p>
                Following a 30-day free trial period, the Service charges a fee of <strong className="text-foreground">1% of each self-reported sale amount</strong> entered by the user. This fee is charged solely for access to and use of the Service software.
              </p>
              <p>
                <strong className="text-foreground">Important:</strong> The Service fee is not a commission on actual transaction proceeds received by the user. The fee is calculated based solely on the sale amount entered by the user within the App. The Service is not a party to any transaction between the user and any buyer or Marketplace. The Service has no right, claim, or interest in any transaction proceeds, and its fee does not constitute a claim on, lien against, or interest in any actual funds received from any sale.
              </p>
              <p>
                Users are solely responsible for accurately reporting sale amounts. The Service takes no responsibility for and makes no representations regarding the accuracy of user-entered data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">4. Currency Conversion Disclaimer</h2>
              <p>
                The Service provides estimated currency conversions for informational purposes only using approximate exchange rates. These conversions are not guaranteed to reflect real-time or official exchange rates. Users are responsible for verifying actual prices and exchange rates before publishing listings. The Service is not liable for any losses resulting from currency conversion inaccuracies.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">5. AI-Generated Content Disclaimer</h2>
              <p>
                Product titles, descriptions, and other content generated by the Service's artificial intelligence features are provided as suggestions only. The Service does not warrant the accuracy, completeness, or fitness for purpose of any AI-generated content. Users are solely responsible for reviewing, editing, and approving all content before publication and for ensuring compliance with applicable laws and Marketplace policies regarding product descriptions, claims, and representations.
              </p>
              <p>
                Users must not use the Service to create listings for prohibited, counterfeit, illegal, or restricted items. Users are solely responsible for ensuring their listings comply with all applicable laws, regulations, and Marketplace policies.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">6. Limitation of Liability</h2>
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
              <h2 className="text-lg font-semibold text-foreground">7. User Responsibilities</h2>
              <p>By using the Service, you agree that you are solely responsible for:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Complying with the terms of service of any Marketplace on which you list products</li>
                <li>Ensuring the accuracy of all product information, pricing, and availability</li>
                <li>Fulfilling all orders and transactions you enter into with buyers</li>
                <li>Paying all applicable taxes on sales proceeds you receive</li>
                <li>Obtaining all necessary rights and permissions to sell any listed items</li>
                <li>Complying with all applicable local, national, and international laws and regulations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">8. Disclaimer of Warranties</h2>
              <p>
                The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. The Service does not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">9. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless the Service, its owners, operators, employees, and affiliates from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your use of the Service, your violation of these Terms, or your violation of any rights of a third party.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">10. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located within the United States.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">11. Changes to Terms</h2>
              <p>
                The Service reserves the right to modify these Terms at any time. Continued use of the Service after any modification constitutes acceptance of the updated Terms. Users are encouraged to review these Terms periodically.
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
