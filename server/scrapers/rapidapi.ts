// rapidapi.ts
export const scrapeProduct = async (query: string): Promise<any> => {
  try {
    console.log(`🔎 RapidAPI: Searching for "${query}" on eBay...`);
 
    // Replace with your actual RapidAPI endpoint and key
    const url = `https://ebay-data-scraper.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1`;
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
        'X-RapidAPI-Host': 'ebay-data-scraper.p.rapidapi.com',
      },
    };
 
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`RapidAPI status ${response.status}`);
 
    const data = await response.json();
    const items = data.items || data.results || [];
    if (items.length === 0) throw new Error('No products found');
 
    const first = items[0];
 
    return {
      title: first.title || query,
      brand: first.brand || extractBrandFromTitle(first.title),
      description: first.description || `High-quality ${first.title} - sourced from eBay via RapidAPI.`,
      price: parsePrice(first.price),
      category: first.category || 'General',
      condition: first.condition || 'New',
      isExactMatch: true,
    };
  } catch (error: any) {
    console.error('❌ RapidAPI scraping error:', error.message || error);
    return {
      title: query,
      brand: '',
      description: 'Product description not available from RapidAPI.',
      price: undefined,
      category: 'General',
      condition: 'New',
      isExactMatch: false,
    };
  }
 };
 
 function extractBrandFromTitle(title: string): string {
  const brands = ['Nikon', 'Canon', 'Sony', 'Apple', 'Samsung', 'LG', 'Bose', 'Dell', 'HP'];
  for (const b of brands) {
    if (title.toLowerCase().includes(b.toLowerCase())) return b;
  }
  return '';
 }
 
 function parsePrice(price: any): number | undefined {
  if (typeof price === 'number') return price;
  if (!price) return undefined;
  const str = String(price);
  const match = str.match(/[\d,]+\.?\d*/);
  if (match) return parseFloat(match[0].replace(/,/g, ''));
  return undefined;
 }