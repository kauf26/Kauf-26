

export const scrapeProduct = async (query: string) => {
 try {
   console.log(`🚀 Oxylabs: Searching for "${query}" on eBay...`);

   const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Basic ' + Buffer.from(`${process.env.OXYLABS_USER}:${process.env.OXYLABS_PASS}`).toString('base64'),
     },
     body: JSON.stringify({
       source: 'ebay_search',
       domain: 'com',
       query: query,
       parse: true,
     }),
   });

   if (!response.ok) {
     throw new Error(`Oxylabs API responded with status: ${response.status}`);
   }

   const data: any = await response.json();

   // Extracting the actual listings from the Oxylabs parsed response
   const results = data.results?.[0]?.content?.results || [];

   // Map the results to your Kauf26 data format
   return results.map((item: any) => ({
     title: item.title,
     price: item.price,
     currency: item.currency || 'USD',
     url: item.url,
     image: item.images?.[0] || '',
     source: "eBay via Oxylabs"
   }));

 } catch (error: any) {
   console.error("❌ Oxylabs scraping error:", error.message || error);
   return []; // Return empty array so the app doesn't crash
 }
};