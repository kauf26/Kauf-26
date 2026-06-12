import { API_BASE_URL } from './config';
import { parseJsonResponse } from './httpResponse';
import type { PublishedListing } from '../../../shared/publishedListings';

export type { PublishedListing };

export async function fetchPublishedListings(): Promise<PublishedListing[]> {
  const response = await fetch(`${API_BASE_URL}/api/listings`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load published listings (${response.status})`);
  }

  const rows = await parseJsonResponse<PublishedListing[]>(response);
  return Array.isArray(rows) ? rows : [];
}
