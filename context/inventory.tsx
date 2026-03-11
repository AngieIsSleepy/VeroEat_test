import React, { createContext, useContext, useMemo, useState } from 'react';

// 定义基础接口
export interface InventoryItem {
  id: string;
  name: string;
  barcode: string;
  imageUrl?: string;
  addedAt: number;
  scannedBy?: string; // 记录是谁扫的
  isSafe?: boolean;   // 记录是否安全
}

type InventoryContextValue = {
  items: InventoryItem[];
  // 更新这里：允许接收 scannedBy 和 isSafe
  addItem: (item: { 
    name: string; 
    barcode: string; 
    imageUrl?: string; 
    scannedBy?: string; 
    isSafe?: boolean 
  }) => boolean; 
  removeItem: (barcode: string) => void;
  clear: () => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);

  const addItem: InventoryContextValue['addItem'] = ({ name, barcode, imageUrl, scannedBy, isSafe }) => {
    const id = barcode;
    let added = false;
    setItems((prev) => {
      if (prev.some((x) => x.id === id)) return prev;
      added = true;
      // 这里的返回值必须包含新字段，否则渲染时拿不到数据
      return [{ 
        id, 
        name, 
        barcode, 
        imageUrl, 
        scannedBy, 
        isSafe, 
        addedAt: Date.now() 
      }, ...prev];
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