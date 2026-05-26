import axios from 'axios';
const OXYLABS_USER = process.env.OXYLABS_USERNAME || '';
const OXYLABS_PASS = process.env.OXYLABS_PASSWORD || '';

// Accessing the keys we just saw in your .env


export const scrapeDepop = async (searchTerm: string) => {
 console.log(`Starting Depop scrape for: ${searchTerm}...`);

 try {
   // Using Oxylabs as a proxy to avoid being blocked by Depop
   const response = await axios.get(`https://www.depop.com/search/?q=${searchTerm}`, {
     proxy: {
       host: 'realtime.oxylabs.io',
       port: 60000,
       auth: {
         username: OXYLABS_USER,
         password: OXYLABS_PASS,
       },
     },
   });

   // logic to parse the response and save to your Postgres DB will go here
   console.log("Data received from Depop!");
   return response.data;
 } catch (error) {
   console.error("Error scraping Depop:", error);
 }
};
