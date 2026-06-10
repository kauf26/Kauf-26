/** Reset in-memory listing flow state on mobile (no draft resume in local storage). */
export type MobileListingResetState = {
  setImage: (value: string | null) => void;
  setGalleryImages: (value: string[]) => void;
  setDraftId: (value: number | null) => void;
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  setBrand: (value: string) => void;
  setModelNumber: (value: string) => void;
  setColor: (value: string) => void;
  setMaterial: (value: string) => void;
  setPrice: (value: string) => void;
  setEbayAverage: (value: string) => void;
  setAllegroAverage: (value: string) => void;
  setCondition: (value: 'new' | 'used') => void;
  setSelectedMarketplaces: (value: string[]) => void;
  setIsAnalyzing: (value: boolean) => void;
  setIsListing: (value: boolean) => void;
  setIsAddingPhotos: (value: boolean) => void;
  bumpFlowSessionKey: () => void;
};

export function resetMobileListingFlow(state: MobileListingResetState): void {
  state.setImage(null);
  state.setGalleryImages([]);
  state.setDraftId(null);
  state.setTitle('');
  state.setDescription('');
  state.setBrand('');
  state.setModelNumber('');
  state.setColor('');
  state.setMaterial('');
  state.setPrice('');
  state.setEbayAverage('');
  state.setAllegroAverage('');
  state.setCondition('new');
  state.setSelectedMarketplaces([]);
  state.setIsAnalyzing(false);
  state.setIsListing(false);
  state.setIsAddingPhotos(false);
  state.bumpFlowSessionKey();
}
