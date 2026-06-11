export type IdentifyTranslation = {
  applied?: boolean;
  targetLang?: string | null;
  originalTitle?: string;
  originalDescription?: string;
  translatedTitle?: string | null;
  translatedDescription?: string | null;
  error?: string | null;
  marketplaceIds?: string[];
};

export type IdentifyProduct = {
  title?: string;
  description?: string;
  longDescription?: string;
  price?: string | number;
  priceReliable?: boolean;
  medianPrice?: string | number;
  brand?: string;
  model?: string;
  referenceNumber?: string;
  category?: string;
  condition?: string;
  material?: string;
  color?: string;
  style?: string;
  allegroAvg?: string | number;
  ebayAvg?: string | number;
  capturedImage?: string;
  capturedImages?: string[];
  isExactMatch?: boolean;
  matchType?: string;
  scraperSource?: string | null;
};

export type IdentifyApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  requiresManualReview?: boolean;
  fallbackToVision?: boolean;
  priceReliable?: boolean;
  isExactMatch?: boolean;
  matchType?: string;
  translation?: IdentifyTranslation | null;
  product?: IdentifyProduct;
  draftPreview?: {
    title?: string;
    attributes?: Record<string, unknown>;
  };
};

export type IdentifyEditPayload = {
  title: string;
  brand: string;
  description: string;
  price: string;
  category: string;
  condition: string;
  material: string;
  color: string;
  model: string;
  requiresManualReview: boolean;
  priceReliable: boolean;
  isExactMatch: boolean;
  matchType: string;
  translation: IdentifyTranslation | null;
  capturedImage: string | null;
  capturedImages: string[];
  raw: IdentifyApiResponse;
};

export type HomeStackParamList = {
  Identify: undefined;
  Edit: { result: IdentifyEditPayload };
};
