# Marketplace Setup Checklist for kaufai.com

## Redirect URIs to configure (same for all OAuth marketplaces)
- Mobile deep link: `kauf26://oauth/{marketplace_id}`
- Web callback: `https://api.kaufai.com/api/auth/callback`

## 1. eBay
- [ ] Developer Portal: https://developer.ebay.com/my/keys
- [ ] Create an application → get **Client ID (App ID)** and **Client Secret (Cert ID)**
- [ ] Add both redirect URIs (above)
- [ ] Request scopes: `https://api.ebay.com/oauth/api_scope/sell.inventory`, `https://api.ebay.com/oauth/api_scope/sell.account`, `https://api.ebay.com/oauth/api_scope/commerce.identity.readonly`
- [ ] Set env vars: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`

## 2. Etsy
- [ ] Developer Portal: https://www.etsy.com/developers/your-apps
- [ ] Create a new app → get **Keystring (Client ID)** and **Shared Secret (Client Secret)**
- [ ] Add both redirect URIs (above)
- [ ] Request scopes: `email_r`, `listings_r`, `listings_w`, `shops_r`, `shops_w`
- [ ] Set env vars: `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`

## 3. Shopify
- [ ] Partners Dashboard: https://partners.shopify.com/ (login → Apps)
- [ ] Create a custom/public app → get **Client ID** and **Client Secret**
- [ ] Add both redirect URIs (above)
- [ ] Request scopes: `read_products`, `write_products`
- [ ] Set env vars: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`

## 4. Allegro
- [ ] Developer Portal: https://developer.allegro.pl/my/application
- [ ] Create an application → get **Client ID** and **Client Secret**
- [ ] Add both redirect URIs (above)
- [ ] Request scopes: `allegro:api:sale:offers:write`, `allegro:api:profile:read`
- [ ] Set env vars: `ALLEGRO_CLIENT_ID`, `ALLEGRO_CLIENT_SECRET`

After obtaining all keys, add them to your `.env.production` file on the server and restart the backend.
