import React, { createContext, useContext, useMemo, useState } from 'react';

// 1. 更新接口：增加保质期和 AI 总结字段
export interface InventoryItem {
  id: string; 
  name: string;
  barcode: string;
  imageUrl?: string;
  addedAt: number;
  scannedBy?: string; 
  isSafe?: boolean;   
  expiryDate?: number;       // 存储过期时间戳
  ingredientsSummary?: string; // AI 总结后的简洁排版内容
}

type InventoryContextValue = {
  items: InventoryItem[];
  addItem: (item: { 
    name: string; 
    barcode: string; 
    imageUrl?: string; 
    scannedBy?: string; 
    isSafe?: boolean;
    expiryDate?: number;       // 新增参数
    ingredientsSummary?: string; // 新增参数
  }) => boolean; 
  removeItem: (id: string) => void;
  clear: () => void;
  removeItemsByProfile: (profileName: string) => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);

  // 实现添加逻辑
  const addItem: InventoryContextValue['addItem'] = ({ 
    name, 
    barcode, 
    imageUrl, 
    scannedBy, 
    isSafe,
    expiryDate,
    ingredientsSummary 
  }) => {
    // 1. 生成一个绝对不重复的专属 ID
    const uniqueId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    setItems((prev) => {
      // 2. 将新项插入列表顶部
      return [{ 
        id: uniqueId, 
        name, 
        barcode, 
        imageUrl, 
        scannedBy, 
        isSafe, 
        expiryDate,          // 存入新字段
        ingredientsSummary,   // 存入新字段
        addedAt: Date.now() 
      }, ...prev];
    });
    
    return true; 
  };

  // 4. 修改删除逻辑：精准打击
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  // 根据 Profile 名称批量删除
  const removeItemsByProfile = (profileName: string) => {
    setItems((prev) => prev.filter((x) => x.scannedBy !== profileName));
  };

  const clear = () => setItems([]);

  const value = useMemo(() => ({ 
    items, 
    addItem, 
    removeItem, 
    clear, 
    removeItemsByProfile 
  }), [items]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used inside InventoryProvider');
  return ctx;
}