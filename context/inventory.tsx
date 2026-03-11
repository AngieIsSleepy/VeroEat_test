import React, { createContext, useContext, useMemo, useState } from 'react';

// 定义基础接口
export interface InventoryItem {
  id: string; // 现在的 id 将是独一无二的
  name: string;
  barcode: string;
  imageUrl?: string;
  addedAt: number;
  scannedBy?: string; // 记录是谁扫的
  isSafe?: boolean;   // 记录是否安全
}

type InventoryContextValue = {
  items: InventoryItem[];
  addItem: (item: { 
    name: string; 
    barcode: string; 
    imageUrl?: string; 
    scannedBy?: string; 
    isSafe?: boolean 
  }) => boolean; 
  // 🚨 关键修复：删除时必须按独一无二的 id 删，而不是条形码
  removeItem: (id: string) => void;
  clear: () => void;

  // 1. 在 type InventoryContextValue 里面加上这行：
  removeItemsByProfile: (profileName: string) => void;


};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);

  const addItem: InventoryContextValue['addItem'] = ({ name, barcode, imageUrl, scannedBy, isSafe }) => {
    // 1. 生成一个绝对不重复的专属 ID (时间戳 + 随机数)
    const uniqueId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    setItems((prev) => {
      // 2. 直接无脑塞进列表，不再做去重拦截！
      return [{ 
        id: uniqueId, 
        name, 
        barcode, 
        imageUrl, 
        scannedBy, 
        isSafe, 
        addedAt: Date.now() 
      }, ...prev];
    });
    
    // 3. 永远返回 true，因为每次都必定添加成功
    return true; 
  };

  // 4. 修改删除逻辑：精准打击，只删点击的那一个
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };
  // 2. 在 InventoryProvider 组件里面（跟 removeItem 写在一起），加上这个函数：
  const removeItemsByProfile = (profileName: string) => {
    setItems((prev) => prev.filter((x) => x.scannedBy !== profileName));
  };
  const clear = () => setItems([]);

  const value = useMemo(() => ({ items, addItem, removeItem, clear, removeItemsByProfile }), [items]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used inside InventoryProvider');
  return ctx;
}