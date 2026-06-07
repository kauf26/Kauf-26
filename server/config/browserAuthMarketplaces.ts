/**
 * Marketplaces that support headless browser seller login during onboarding.
 */
export type BrowserAuthMarketplace = {
  id: string;
  name: string;
  loginUrl: string;
  verifyUrl: string;
  strategy: "ebay" | "standard";
};

export const BROWSER_AUTH_MARKETPLACES: BrowserAuthMarketplace[] = [
  {
    id: "ebay",
    name: "eBay",
    loginUrl: "https://signin.ebay.com/ws/eBayISAPI.dll?SignIn",
    verifyUrl: "https://www.ebay.com/sh/ovw",
    strategy: "ebay",
  },
  {
    id: "etsy",
    name: "Etsy",
    loginUrl: "https://www.etsy.com/signin",
    verifyUrl: "https://www.etsy.com/your/shops/me/dashboard",
    strategy: "standard",
  },
  {
    id: "poshmark",
    name: "Poshmark",
    loginUrl: "https://poshmark.com/login",
    verifyUrl: "https://poshmark.com/closet",
    strategy: "standard",
  },
  {
    id: "depop",
    name: "Depop",
    loginUrl: "https://www.depop.com/login/",
    verifyUrl: "https://www.depop.com/products/create/",
    strategy: "standard",
  },
  {
    id: "grailed",
    name: "Grailed",
    loginUrl: "https://www.grailed.com/users/sign_in",
    verifyUrl: "https://www.grailed.com/sell",
    strategy: "standard",
  },
  {
    id: "mercari",
    name: "Mercari",
    loginUrl: "https://www.mercari.com/login/",
    verifyUrl: "https://www.mercari.com/mypage/",
    strategy: "standard",
  },
  {
    id: "shopify",
    name: "Shopify",
    loginUrl: "https://accounts.shopify.com/store-login",
    verifyUrl: "https://admin.shopify.com/",
    strategy: "standard",
  },
];

export function getBrowserAuthMarketplace(id: string): BrowserAuthMarketplace | undefined {
  return BROWSER_AUTH_MARKETPLACES.find((m) => m.id === id);
}
