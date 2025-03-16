import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface TradingSymbol {
  id: string;
  name: string;
  description: string;
  currentPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SymbolState {
  symbols: TradingSymbol[];
  setSymbols: (symbols: TradingSymbol[]) => void;
  reset: () => void;
}

const initialState = {
  symbols: [],
};

export const useSymbolStore = create<SymbolState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setSymbols: (symbols) => set({ symbols }),
        reset: () => set(initialState),
      }),
      {
        name: "symbol-storage",
        partialize: (state) => ({
          symbols: state.symbols,
        }),
      }
    )
  )
);
