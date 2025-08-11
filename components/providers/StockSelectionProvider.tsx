"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type StockSelection = { symbol: string; name?: string } | null;

interface StockSelectionContextType {
  selection: StockSelection;
  requestSelection: (symbol: string, name?: string) => void;
  clearSelection: () => void;
}

const StockSelectionContext = createContext<StockSelectionContextType | undefined>(undefined);

export function StockSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<StockSelection>(null);

  const requestSelection = (symbol: string, name?: string) => setSelection({ symbol, name });
  const clearSelection = () => setSelection(null);

  return (
    <StockSelectionContext.Provider value={{ selection, requestSelection, clearSelection }}>
      {children}
    </StockSelectionContext.Provider>
  );
}

export function useStockSelection() {
  const ctx = useContext(StockSelectionContext);
  if (!ctx) throw new Error("useStockSelection must be used within a StockSelectionProvider");
  return ctx;
}


