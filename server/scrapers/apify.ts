export const scrapeProduct = async (url: string) => {
    try {
      console.log(`Scraping ${url} using Apify...`);
   
      // Placeholder for actual Apify SDK or API call
      return {
        title: "Pending Apify Title",
        price: 0,
        description: "",
        images: [],
        source: "Apify"
      };
    } catch (error: any) {
      console.error("Apify scraping error:", error.message || error);
      throw error;
    }
   };