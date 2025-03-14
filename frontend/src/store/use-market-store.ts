import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface Symbol {
  id: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  minQuantity: number;
  maxQuantity: number;
  pricePrecision: number;
  quantityPrecision: number;
  minNotional: number;
  status: "TRADING" | "HALTED";
}

export interface PriceUpdate {
  price: number;
  timestamp: number;
}

interface MarketState {
  symbols: Symbol[];
  selectedSymbol: Symbol | null;
  priceUpdates: Record<string, PriceUpdate[]>;
  latestPrices: Record<string, number>;
  isConnected: boolean;

  setSymbols: (symbols: Symbol[]) => void;
  setSelectedSymbol: (symbol: Symbol | null) => void;
  addPriceUpdate: (symbolId: string, price: number) => void;
  setLatestPrice: (symbolId: string, price: number) => void;
  setIsConnected: (isConnected: boolean) => void;
  reset: () => void;
}

const MAX_PRICE_HISTORY = 100;

const initialState = {
  symbols: [],
  selectedSymbol: null,
  priceUpdates: {},
  latestPrices: {},
  isConnected: false,
};

export const useMarketStore = create<MarketState>()(
  devtools((set) => ({
    ...initialState,

    setSymbols: (symbols) => set({ symbols }),

    setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),

    addPriceUpdate: (symbolId, price) =>
      set((state) => {
        const timestamp = Date.now();
        const currentUpdates = state.priceUpdates[symbolId] || [];

        // Add new price update
        const newUpdates = [...currentUpdates, { price, timestamp }].slice(
          -MAX_PRICE_HISTORY
        ); // Keep only the last MAX_PRICE_HISTORY updates

        return {
          priceUpdates: {
            ...state.priceUpdates,
            [symbolId]: newUpdates,
          },
          latestPrices: {
            ...state.latestPrices,
            [symbolId]: price,
          },
        };
      }),

    setLatestPrice: (symbolId, price) =>
      set((state) => ({
        latestPrices: {
          ...state.latestPrices,
          [symbolId]: price,
        },
      })),

    setIsConnected: (isConnected) => set({ isConnected }),

    reset: () => set(initialState),
  }))
);
