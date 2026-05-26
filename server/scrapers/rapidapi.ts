// server/scrapers/rapidapi.ts
export const scrapeProduct = async (query: string): Promise<any> => {
  try {
    console.log(`🔎 RapidAPI: Searching for "${query}"...`);
 
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
 
    if (items.length === 0) return getGeneralDescription(query);
 
    const first = items[0];
 
    return {
      title: first.title || query,
      brand: first.brand || extractBrandFromTitle(first.title || ''),
      description: truncateDescription(first.description || `High-quality ${first.title}`),
      price: parsePrice(first.price),
      category: first.category || 'General',
      condition: first.condition || 'New',
      isExactMatch: true,
    };
  } catch (error: any) {
    console.error('❌ RapidAPI scraping error:', error.message || error);
    return getGeneralDescription(query);
  }
 };
 
 // Standardized helpers
 const truncateDescription = (text: string): string => {
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
 };
 
 const parsePrice = (price: any): number | undefined => {
  if (typeof price === 'number') return price;
  if (!price) return undefined;
  const match = String(price).match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : undefined;
 };
 
 const getGeneralDescription = (query: string) => ({
  title: query,
  brand: 'N/A',
  description: `A general listing for "${query}". Details pending manual review.`,
  price: undefined,
  category: 'General',
  condition: 'New',
  isExactMatch: false,
 });
 
 const extractBrandFromTitle = (title: string): string => {
  const brands = ['Nikon', 'Canon', 'Sony', 'Apple', 'Samsung', 'LG', 'Bose', 'Dell', 'HP'];
  return brands.find(b => title.toLowerCase().includes(b.toLowerCase())) || '';
 };