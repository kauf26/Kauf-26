// API configuration for the mobile app — see config.ts for API_BASE_URL resolution.

import { fetchProductsWithBackoff } from './productsFetch';
import { API_BASE_URL } from './config';
import { parseJsonResponse } from './httpResponse';

export { API_BASE_URL };

// @ts-ignore - __DEV__ is defined by React Native
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
void isDev;

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
  
  return parseJsonResponse<T>(response);
}

// Product API
export const productsApi = {
  analyze: (image: string) =>
    apiRequest('/api/products/analyze', {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),
    
  getAll: () => fetchProductsWithBackoff(),
  
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
