// server/services/rapidapi.ts

export class RapidApiService {
    private static readonly BASE_URL = 'https://any-marketplace-api.p.rapidapi.com';
   
    /**
     * Universal fetcher for RapidAPI marketplace integrations.
     * This will be the hub for your 26+ marketplace connections.
     */
    static async callMarketplace(endpoint: string, method: string = 'GET', data?: any) {
      const apiKey = process.env.RAPIDAPI_KEY;
   
      if (!apiKey) {
        console.error("Missing RapidAPI Key in .env");
        return null;
      }
   
      const options = {
        method: method,
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'any-marketplace-api.p.rapidapi.com',
          'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
      };
   
      try {
        const response = await fetch(`${this.BASE_URL}${endpoint}`, options);
        return await response.json();
      } catch (error) {
        console.error("RapidAPI Request Failed:", error);
        throw error;
      }
    }
   }
   