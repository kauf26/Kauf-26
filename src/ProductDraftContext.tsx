import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

// Define the exact blueprint of a product draft in your app
export interface ProductDraft {
 title: string;
 brand: string;
 description: string;
 price: number;
 category: string;
 condition: string;
 images?: string[];
}

// Define what values and setters the context bucket will expose
interface ProductDraftContextType {
 draft: ProductDraft | null;
 setDraft: (draft: ProductDraft | null) => void;
 clearDraft: () => void;
}

// Initialize the context
const ProductDraftContext = createContext<ProductDraftContextType | undefined>(undefined);

// Create the Provider component that houses the state
export function ProductDraftProvider({ children }: { children: ReactNode }) {
 const [draft, setDraft] = useState<ProductDraft | null>(null);

 const clearDraft = useCallback(() => setDraft(null), []);

 const value = useMemo(
   () => ({ draft, setDraft, clearDraft }),
   [draft, clearDraft]
 );

 return (
   <ProductDraftContext.Provider value={value}>
     {children}
   </ProductDraftContext.Provider>
 );
}

// Create a custom hook for clean consumption in your pages
export function useProductDraft() {
 const context = useContext(ProductDraftContext);
 if (context === undefined) {
   throw new Error('useProductDraft must be used within a ProductDraftProvider');
 }
 return context;
}
