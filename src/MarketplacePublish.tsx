import { useState, useEffect } from 'react';
import { useProductDraft } from './ProductDraftContext';

type Marketplace = {
    id: string;
    name: string;
    currency: string;
    country: string;
    region: 'US' | 'Global';
    status: 'idle' | 'loading' | 'error';
};

const allMarketplaces: Marketplace[] = [
    { id: "aliexpress", name: "AliExpress", currency: "CNY", country: "🇨🇳", region: "Global", status: "idle" },
    { id: "allegro", name: "Allegro", currency: "PLN", country: "🇵🇱", region: "Global", status: "idle" },
    { id: "amazon", name: "Amazon", currency: "USD", country: "🇺🇸", region: "US", status: "idle" },
    { id: "bigcommerce", name: "BigCommerce", currency: "USD", country: "🌍", region: "Global", status: "idle" },
    { id: "bolcom", name: "Bol.com", currency: "EUR", country: "🇳🇱", region: "Global", status: "idle" },
    { id: "depop", name: "Depop", currency: "USD", country: "🇬🇧", region: "US", status: "idle" },
    { id: "ebay", name: "eBay", currency: "USD", country: "🇺🇸", region: "US", status: "idle" },
    { id: "etsy", name: "Etsy", currency: "USD", country: "🇺🇸", region: "Global", status: "idle" },
    { id: "flipkart", name: "Flipkart", currency: "INR", country: "🇮🇳", region: "Global", status: "idle" },
    { id: "fruugo", name: "Fruugo", currency: "GBP", country: "🇬🇧", region: "Global", status: "idle" },
    { id: "lazada", name: "Lazada", currency: "SGD", country: "🇸🇬", region: "Global", status: "idle" },
    { id: "magento", name: "Magento", currency: "USD", country: "🌍", region: "Global", status: "idle" },
    { id: "mercadolibre", name: "MercadoLibre", currency: "ARS", country: "🇦🇷", region: "Global", status: "idle" },
    { id: "mercadolibre_br", name: "Mercado Livre (Brazil)", currency: "BRL", country: "🇧🇷", region: "Global", status: "idle" },
    { id: "newegg", name: "Newegg", currency: "USD", country: "🇺🇸", region: "US", status: "idle" },
    { id: "poshmark", name: "Poshmark", currency: "USD", country: "🇺🇸", region: "US", status: "idle" },
    { id: "rakuten", name: "Rakuten", currency: "JPY", country: "🇯🇵", region: "Global", status: "idle" },
    { id: "shopee", name: "Shopee", currency: "SGD", country: "🇸🇬", region: "Global", status: "idle" },
    { id: "shopify", name: "Shopify", currency: "USD", country: "🌍", region: "Global", status: "idle" },
    { id: "stockx", name: "StockX", currency: "USD", country: "🇺🇸", region: "US", status: "idle" },
    { id: "taobao", name: "Taobao", currency: "CNY", country: "🇨🇳", region: "Global", status: "idle" },
    { id: "tiktokshop", name: "TikTok Shop", currency: "USD", country: "🌍", region: "Global", status: "idle" },
    { id: "vinted", name: "Vinted", currency: "EUR", country: "🇱🇻", region: "Global", status: "idle" },
    { id: "wayfair", name: "Wayfair", currency: "USD", country: "🇺🇸", region: "US", status: "idle" },
    { id: "woocommerce", name: "WooCommerce", currency: "USD", country: "🌍", region: "Global", status: "idle" },
    { id: "zalando", name: "Zalando", currency: "EUR", country: "🇩🇪", region: "Global", status: "idle" },
];

export default function MarketplacePublish() {
 const { draft } = useProductDraft();

 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load saved selections from localStorage (optional)
  useEffect(() => {
    const saved = localStorage.getItem('marketplaceSelections');
    if (saved) {
      setSelectedIds(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save selections whenever they change
  useEffect(() => {
    localStorage.setItem('marketplaceSelections', JSON.stringify([...selectedIds]));
  }, [selectedIds]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Group marketplaces by region
  const usMarketplaces = allMarketplaces.filter(mp => mp.region === 'US');
  const globalMarketplaces = allMarketplaces.filter(mp => mp.region === 'Global');

  // Render a single marketplace card with toggle switch
  const renderMarketplaceCard = (mp: Marketplace) => {
    const isSelected = selectedIds.has(mp.id);
    const isDisabled = mp.status !== 'idle';

    return (
      <div
        key={mp.id}
        style={{
          border: '1px solid #3f3f46',
          backgroundColor: 'rgba(24, 24, 27, 0.5)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '500', color: 'white' }}>
            {mp.name} ({mp.country})
          </span>
          <button
            onClick={() => toggleSelection(mp.id)}
            disabled={isDisabled}
            style={{
              position: 'relative',
              width: '48px',
              height: '24px',
              borderRadius: '9999px',
              backgroundColor: isSelected ? '#22c55e' : '#ef4444',
              opacity: isDisabled ? 0.5 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              border: 'none',
              transition: 'background-color 0.2s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: '2px',
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                borderRadius: '9999px',
                transform: isSelected ? 'translateX(24px)' : 'translateX(0)',
                transition: 'transform 0.2s ease',
              }}
            />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
        Publish to Marketplaces
      </h1>
      <p style={{ color: '#a1a1aa', marginBottom: '24px' }}>
        Select where you want to list your items. Green = selected, red = not selected.
      </p>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#e4e4e7', borderBottom: '1px solid #3f3f46', paddingBottom: '8px', marginBottom: '16px' }}>
          🇺🇸 US Marketplaces
        </h2>
        {usMarketplaces.map(renderMarketplaceCard)}
      </div>

      <div>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#e4e4e7', borderBottom: '1px solid #3f3f46', paddingBottom: '8px', marginBottom: '16px' }}>
          🌍 Global Marketplaces
        </h2>
        {globalMarketplaces.map(renderMarketplaceCard)}
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <button
         onClick={async () => {
          const selectedNames = allMarketplaces
            .filter(mp => selectedIds.has(mp.id))
            .map(mp => mp.name);

          try {
            const res = await fetch("/api/drafts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  selectedMarketplaces: [...selectedIds],
              })
            });

            if (res.ok) {
                alert(`Success! Published to:\n${selectedNames.join('\n')}`);
            } else {
                alert("Failed to save draft.");
            }
          } catch (err) {
            console.error("Fetch error:", err);
          }
        }}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '10px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
        >
          Publish Selected ({selectedIds.size})
          </button>
     </div>
   </div>
 );
}
