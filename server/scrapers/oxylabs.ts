// server/scrapers/oxylabs.ts
export const scrapeProduct = async (query: string, _context?: unknown) => {
  try {
    console.log(`OxyLabs: Searching for "${query}"...`);
 
    // In a real scenario, you would insert your actual API fetch call here:
    // const response = await fetch('https://data.oxylabs.io/...', { ... });
    // const data = await response.json();
 
    // Placeholder for your actual logic:
    const data = {
       title: `Result for ${query}`,
       description: "This is a detailed description of the product found via Oxylabs. It is kept concise to ensure it fits perfectly within the app's review interface.",
       price: 499.99
    };
 
    return {
      title: data.title || query,
      brand: extractBrandFromTitle(data.title),
      description: truncateDescription(data.description),
      price: parsePrice(data.price),
      category: 'Electronics',
      condition: 'New',
      isExactMatch: true,
    };
  } catch (error) {
    console.error('❌ Oxylabs Error:', error);
    return getGeneralDescription(query);
  }
 };
 
 // Standardized helpers to ensure consistency across all scrapers
 const truncateDescription = (text: string): string => {
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
 };
 
 const parsePrice = (price: any): number | undefined => {
  const str = String(price).replace(/[^0-9.]/g, '');
  return isNaN(parseFloat(str)) ? undefined : parseFloat(str);
 };
 
 const getGeneralDescription = (query: string) => ({
  title: query,
  brand: "",
  description: "",
  price: undefined,
  category: "",
  condition: "",
  isExactMatch: false,
 });
 
 const extractBrandFromTitle = (title: string): string => {
  const brands = ['Nikon', 'Canon', 'Sony', 'Apple', 'Samsung'];
  const found = brands.find(b => title.toLowerCase().includes(b.toLowerCase()));
  return found || 'Generic';
 };