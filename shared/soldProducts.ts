export type SoldProductSummary = {
  id: number;
  title: string;
  thumbnail: string | null;
  total_quantity_sold: number;
  total_revenue: string;
  most_recent_sale_date: string;
};

export type SoldProductsResponse = {
  totalSoldProducts: number;
  products: SoldProductSummary[];
  page: number;
  limit: number;
  hasMore: boolean;
};
