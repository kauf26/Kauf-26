// API configuration for the mobile app
// UPDATE THIS URL before building for production!
// For development with physical device, use your computer's LAN IP (e.g., 'http://192.168.1.100:5000')
// For production, use your deployed Replit app URL

// @ts-ignore - __DEV__ is defined by React Native
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const API_BASE_URL = 'https://global-marketplace-lister.replit.app';  // Your published Replit app URL

// Helper function for API requests
function clientTimeZoneHeader(): Record<string, string> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? { "X-Client-Timezone": tz } : {};
  } catch {
    return {};
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...clientTimeZoneHeader(),
      ...options?.headers,
    },
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Product API
export const productsApi = {
  analyze: (image: string) =>
    apiRequest('/api/products/analyze', {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),
    
  getAll: () => apiRequest('/api/products'),
  
  getById: (id: number) => apiRequest(`/api/products/${id}`),
};

// Listings API
export const listingsApi = {
  create: (data: {
    title: string;
    description: string;
    price: number;
    marketplaces: string[];
    imageUrl?: string;
  }) =>
    apiRequest('/api/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
  getAll: () => apiRequest('/api/listings'),
  
  delete: (id: number) =>
    apiRequest(`/api/listings/${id}`, {
      method: 'DELETE',
    }),
};

// Sales API
export const salesApi = {
  getAll: () => apiRequest('/api/sales'),
  
  recordSale: (data: {
    listingId: number;
    salePrice: number;
  }) =>
    apiRequest('/api/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
