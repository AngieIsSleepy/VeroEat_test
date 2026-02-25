// FILE: context/inventory.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';

export type InventoryItem = {
  id: string;  
  name: string;
  barcode: string;
  imageUrl?: string; 
  addedAt: number;
};

type InventoryContextValue = {
  items: InventoryItem[];
  addItem: (item: { name: string; barcode: string; imageUrl?: string }) => boolean; // true=added, false=already exists
  removeItem: (barcode: string) => void;
  clear: () => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);

  const addItem: InventoryContextValue['addItem'] = ({ name, barcode, imageUrl }) => {
    const id = barcode;
    let added = false;
    setItems((prev) => {
      if (prev.some((x) => x.id === id)) return prev;
      added = true;
      return [{ id, name, barcode, imageUrl, addedAt: Date.now() }, ...prev];
    });
    return added;
  };

  const removeItem = (barcode: string) => {
    setItems((prev) => prev.filter((x) => x.barcode !== barcode));
  };

  const clear = () => setItems([]);

  const value = useMemo(() => ({ items, addItem, removeItem, clear }), [items]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used inside InventoryProvider');
  return ctx;
}
