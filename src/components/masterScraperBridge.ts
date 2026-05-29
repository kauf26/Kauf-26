// No more failing imports here!

export const fetchMasterProductData = async (imageData: string) => {
    const response = await fetch('/api/catalog/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });
   
    if (!response.ok) {
      throw new Error('Failed to reach server scraper');
    }
   
    return response.json();
   };
   
   export const saveToDraftStorage = async (data: any) => {
    // Add your logic to save to local storage or state
    console.log("Saving to draft:", data);
   };
   